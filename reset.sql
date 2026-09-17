begin;
delete from public.event_logs;

delete from public.term_transition_requests;

delete from public.terms
where name <> '2026-27';

update public.terms
set is_active = false;
update public.terms
set is_active = true
where name = '2026-27';

do $$
declare
    active_count integer;
begin

    select count(*)
    into active_count
    from public.terms
    where is_active = true;

    if active_count <> 1 then
        raise exception
        'Reset aborted: expected exactly one active term, found %.',
        active_count;
    end if;

end $$;
commit;

select
    id,
    name,
    is_active
from public.terms
order by id;


select
    count(*) as event_records
from public.event_logs;


select
    count(*) as transition_records
from public.term_transition_requests;
