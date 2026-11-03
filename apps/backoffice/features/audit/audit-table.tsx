import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditEntry } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ACTION_LABELS, ACTOR_LABELS } from '@/lib/staff-words';

/** The first block of an id: enough to tell events apart on the screen. */
const shortId = (id: string) => id.split('-')[0] ?? id;

/** The metadata as `key: value` lines; recorded with allowed fields only (API-04). */
function detailsOf(metadata: AuditEntry['metadata']): [string, string][] {
  return Object.entries(metadata).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]);
}

/**
 * One page of the audit trail, newest first (v1.3.0 plan, task 8): each
 * action in words with its code beside it (H6), the staff by name and
 * anyone else by kind and id (H4), the metadata as text (STF-05). The
 * details wrap, one field a line and long ids broken where needed, so the
 * table fits the page with no sideways scroll.
 */
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-muted-foreground">Nenhum evento aqui.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Quando</TableHead>
          <TableHead>Quem</TableHead>
          <TableHead>O quê</TableHead>
          <TableHead>Sobre</TableHead>
          <TableHead>Detalhes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id} className="align-top">
            <TableCell className="align-top">{formatDateTime(entry.occurredAt)}</TableCell>
            <TableCell className="align-top">
              <span className="block">
                {entry.actor.name ?? ACTOR_LABELS[entry.actor.type] ?? entry.actor.type}
              </span>
              {entry.actor.id && !entry.actor.name ? (
                <span className="block font-mono text-xs text-muted-foreground">
                  {shortId(entry.actor.id)}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="align-top">
              <span className="block font-semibold">
                {ACTION_LABELS[entry.action] ?? entry.action}
              </span>
              {ACTION_LABELS[entry.action] ? (
                <span className="block font-mono text-xs text-muted-foreground">
                  {entry.action}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="align-top font-mono text-xs">
              {entry.subject.type} {shortId(entry.subject.id)}
            </TableCell>
            <TableCell className="w-full min-w-48 align-top text-xs whitespace-normal text-muted-foreground">
              <dl className="space-y-0.5">
                {detailsOf(entry.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="inline font-semibold">{key}: </dt>
                    <dd className="inline font-mono wrap-anywhere">{value}</dd>
                  </div>
                ))}
              </dl>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
