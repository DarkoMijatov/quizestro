import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Trash2, Users, Crown, Shield, User, Copy, Check, Zap, Pencil } from 'lucide-react';
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
  profile?: { full_name: string | null };
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
  const [loading, setLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<MemberRow | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
        .select('user_id, full_name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      for (const m of memberList) {
        m.profile = profileMap.get(m.user_id) as any;
      }
    }
    setMembers(memberList);
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

  const handleCopyInvite = () => {
    const link = `${window.location.origin}/register?org=${currentOrg?.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  // Users can only edit their own name, owners can edit anyone
  const canEditName = (member: MemberRow) => {
    return isOwner || member.user_id === user?.id;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">{t('members.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {members.length} {t('members.memberCount')}
            </p>
          </div>
          {isOwner && (
            <Button onClick={() => setInviteOpen(true)} className="gap-2" disabled={isFree && members.length >= 1}>
              <UserPlus className="h-4 w-4" />
              {t('members.invite')}
            </Button>
          )}
        </div>

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

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('members.noMembers')}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role] || User;
              return (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                      {(member.profile?.full_name || '?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{member.profile?.full_name || t('members.unknown')}</p>
                        {canEditName(member) && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditName(member)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Badge variant="outline" className={`mt-0.5 ${roleBadgeStyles[member.role]}`}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                  {isOwner && member.role !== 'owner' && (
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v as 'admin' | 'user')}>
                        <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteItem(member)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
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
              <Label>{t('members.inviteLink')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/register?org=${currentOrg?.id}`}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={handleCopyInvite}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('members.inviteNote')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t('common.close')}</Button>
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
