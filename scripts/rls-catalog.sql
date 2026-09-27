select 'rls' as kind, relname::text as name, relrowsecurity::text as detail
from pg_class where oid = 'public.profiles'::regclass
union all
select 'policy', policyname::text, concat_ws(' | ', cmd, roles::text, qual, with_check)
from pg_policies where schemaname = 'public' and tablename = 'profiles'
union all
select 'grant',
  case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end,
  a.privilege_type::text
from pg_class c, aclexplode(c.relacl) a where c.oid = 'public.profiles'::regclass
order by 1, 2, 3;
