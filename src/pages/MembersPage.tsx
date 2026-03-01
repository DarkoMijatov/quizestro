import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Trash2, Users, Crown, Shield, User, Pencil, Zap, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface MemberRow {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'user';
  created_at: string;
  profile?: { full_name: string | null; email: string | null };
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const roleIcons: Record<string, React.ElementType> = { owner: Crown, admin: Shield, user: User };
const roleBadgeStyles: Record<string, string> = {
  owner: 'bg-primary/10 text-primary border-primary/30',
  admin: 'bg-accent text-accent-foreground border-accent',
  user: 'bg-muted text-muted-foreground',
};

export default function MembersPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const { user } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<MemberRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user');
  const [inviting, setInviting] = useState(false);

  // Edit name
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [editName, setEditName] = useState('');

  const isOwner = currentRole === 'owner';
  const isAdminOrOwner = currentRole === 'owner' || currentRole === 'admin';
  const isFree = currentOrg?.subscription_tier === 'free';

  const fetchMembers = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data: mems } = await supabase
      .from('memberships')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at') as { data: MemberRow[] | null };

    const memberList = mems || [];
    if (memberList.length > 0) {
      const userIds = memberList.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      for (const m of memberList) {
        m.profile = profileMap.get(m.user_id) as any;
      }
    }
    setMembers(memberList);

    // Fetch pending invites
    const { data: invites } = await supabase
      .from('pending_invites')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setPendingInvites((invites || []) as PendingInvite[]);

    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, [currentOrg?.id]);

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'user') => {
    const { error } = await supabase.from('memberships').update({ role: newRole }).eq('id', memberId);
    if (error) {
      toast({ title: '✗', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✓', description: t('members.roleUpdated') });
      fetchMembers();
    }
  };

  const handleRemove = async () => {
    if (!deleteItem) return;
    await supabase.from('memberships').delete().eq('id', deleteItem.id);
    toast({ title: '✓', description: t('members.removed') });
    setDeleteItem(null);
    fetchMembers();
  };

  const handleInvite = async () => {
    if (!currentOrg || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          organization_id: currentOrg.id,
          role: inviteRole,
        },
      });

      if (error) throw error;
      if (data?.error === 'already_member') {
        toast({ title: '✗', description: t('members.alreadyMember'), variant: 'destructive' });
      } else if (data?.error) {
        toast({ title: '✗', description: data.error, variant: 'destructive' });
      } else if (data?.status === 'added') {
        toast({ title: '✓', description: t('members.addedExisting') });
        setInviteOpen(false);
        setInviteEmail('');
        fetchMembers();
      } else if (data?.status === 'invited') {
        toast({ title: '✓', description: t('members.inviteSent') });
        setInviteOpen(false);
        setInviteEmail('');
        fetchMembers();
      }
    } catch (err: any) {
      toast({ title: '✗', description: err.message || 'Error', variant: 'destructive' });
    }
    setInviting(false);
  };

  const handleCancelInvite = async (inviteId: string) => {
    await supabase.from('pending_invites').delete().eq('id', inviteId);
    toast({ title: '✓', description: t('members.inviteCancelled') });
    fetchMembers();
  };

  const handleEditName = (member: MemberRow) => {
    setEditingMember(member);
    setEditName(member.profile?.full_name || '');
  };

  const handleSaveName = async () => {
    if (!editingMember) return;
    await supabase.from('profiles').update({ full_name: editName.trim() }).eq('user_id', editingMember.user_id);
    toast({ title: '✓', description: t('members.nameUpdated') });
    setEditingMember(null);
    fetchMembers();
  };

  const canEditName = (member: MemberRow) => isOwner || member.user_id === user?.id;

  const columns: Column<MemberRow>[] = [
    {
      key: 'name', label: t('auth.fullName'), sortable: true, render: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
            {(r.profile?.full_name || '?')[0]?.toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-medium">{r.profile?.full_name || t('members.unknown')}</span>
            {r.profile?.email && (
              <span className="text-xs text-muted-foreground">{r.profile.email}</span>
            )}
          </div>
        </div>
      ), getValue: (r) => r.profile?.full_name || '',
    },
    {
      key: 'role', label: t('members.role'), sortable: true, render: (r) => {
        const RoleIcon = roleIcons[r.role] || User;
        return (
          <Badge variant="outline" className={roleBadgeStyles[r.role]}>
            <RoleIcon className="h-3 w-3 mr-1" />
            {r.role}
          </Badge>
        );
      }, getValue: (r) => r.role,
    },
    {
      key: 'actions', label: '', render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          {canEditName(r) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEditName(r); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('members.editName')}</TooltipContent>
            </Tooltip>
          )}
          {isOwner && r.role !== 'owner' && (
            <>
              <Select value={r.role} onValueChange={(v) => handleRoleChange(r.id, v as 'admin' | 'user')}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteItem(r); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('members.remove', 'Ukloni')}</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {isFree && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t('freemium.memberLimit')}</p>
                <p className="text-xs text-muted-foreground">{t('freemium.upgradeForMore')}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1 shrink-0">
              <Zap className="h-3 w-3" />
              {t('freemium.upgrade')}
            </Button>
          </div>
        )}

        <DataTable
          title={t('members.title')}
          columns={columns}
          data={members}
          loading={loading}
          defaultSortKey="role"
          defaultSortDir="asc"
          searchFn={(r, q) => (r.profile?.full_name || '').toLowerCase().includes(q)}
          emptyIcon={<Users className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
          emptyMessage={t('members.noMembers')}
          headerActions={
            isAdminOrOwner ? (
              <Button onClick={() => setInviteOpen(true)} className="gap-2" disabled={isFree && members.length >= 1}>
                <UserPlus className="h-4 w-4" />
                {t('members.invite')}
              </Button>
            ) : undefined
          }
        />

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              {t('members.pendingInvites')}
            </h3>
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <Badge variant="outline" className="mt-1 text-xs">{inv.role}</Badge>
                  </div>
                  {isAdminOrOwner && (
                    <Button variant="ghost" size="sm" onClick={() => handleCancelInvite(inv.id)} className="text-destructive text-xs">
                      {t('common.cancel')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit name dialog */}
      <Dialog open={!!editingMember} onOpenChange={(o) => !o && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('members.editName')}</DialogTitle>
            <DialogDescription>{t('members.editNameDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('auth.fullName')}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveName} disabled={!editName.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('members.inviteTitle')}</DialogTitle>
            <DialogDescription>{t('members.inviteDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('auth.email')}</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t('members.inviteEmailPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('members.role')}</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'user' | 'admin')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">{t('members.inviteNote')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('members.sendInvite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('members.removeConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
