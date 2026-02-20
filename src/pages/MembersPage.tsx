import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Trash2, Users } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const roleBadge: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-blue-500/10 text-blue-600',
  user: 'bg-muted text-muted-foreground',
};

export default function MembersPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<MemberRow | null>(null);

  const isOwner = currentRole === 'owner';

  const fetchMembers = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data: mems } = await supabase
      .from('memberships')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at') as { data: MemberRow[] | null };

    const memberList = mems || [];

    // Fetch profiles for user names
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
    await supabase.from('memberships').update({ role: newRole }).eq('id', memberId);
    toast({ title: '✓', description: t('members.roleUpdated') });
    fetchMembers();
  };

  const handleRemove = async () => {
    if (!deleteItem) return;
    await supabase.from('memberships').delete().eq('id', deleteItem.id);
    toast({ title: '✓', description: t('members.removed') });
    setDeleteItem(null);
    fetchMembers();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t('members.title')}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('members.noMembers')}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {(member.profile?.full_name || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{member.profile?.full_name || t('members.unknown')}</p>
                    <Badge variant="outline" className={roleBadge[member.role]}>{member.role}</Badge>
                  </div>
                </div>
                {isOwner && member.role !== 'owner' && (
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v as 'admin' | 'user')}>
                      <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
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
            ))}
          </div>
        )}
      </div>

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
