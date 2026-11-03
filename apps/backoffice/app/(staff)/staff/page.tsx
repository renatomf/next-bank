import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { NewMemberForm } from '@/features/staff/new-member-form';
import { StaffTable } from '@/features/staff/staff-table';
import { asSignedInMember, signedInMember } from '@/lib/backend';

/** The admin's screen of the staff (v1.3.0 plan, task 7): the list and a new member. */
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await signedInMember();
  if (member.role !== 'ADMIN') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground">Só o admin gerencia a equipe.</p>
      </div>
    );
  }
  const params = await searchParams;
  const cursor = typeof params.cursor === 'string' ? params.cursor : null;
  const page = await asSignedInMember((api) => api.listStaff(cursor));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Equipe</h1>
      <NewMemberForm />
      <StaffTable members={page.items} />
      {page.nextCursor ? (
        <Button asChild variant="outline">
          <Link href={`/staff?cursor=${page.nextCursor}`}>
            Mais antigos
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
