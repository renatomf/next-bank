import { StatusBadge } from '@/components/nb/status-badge';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StaffMemberView } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { STAFF_ROLE_LABELS, STAFF_STATUS_LABELS } from '@/lib/staff-words';
import { MemberActions } from './member-actions';

/**
 * One page of the staff, newest first (v1.3.0 plan, task 7): the role and
 * the status in words. An active operator or analyst offers its actions; an
 * admin, the one signed in included, offers none (G1).
 */
export function StaffTable({ members }: { members: StaffMemberView[] }) {
  if (members.length === 0) return <p className="text-muted-foreground">Ninguém na equipe.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead className="sr-only">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-semibold">
              {member.name}
              {member.isDemo ? (
                <Badge variant="outline" className="ml-2">
                  Demo
                </Badge>
              ) : null}
            </TableCell>
            <TableCell>{member.email}</TableCell>
            <TableCell>{STAFF_ROLE_LABELS[member.role]}</TableCell>
            <TableCell>
              <StatusBadge
                tone={member.status === 'ACTIVE' ? 'ok' : 'closed'}
                label={STAFF_STATUS_LABELS[member.status]}
              />
            </TableCell>
            <TableCell>{formatDateTime(member.createdAt)}</TableCell>
            <TableCell>
              {member.role !== 'ADMIN' && member.status === 'ACTIVE' ? (
                <MemberActions member={member} />
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
