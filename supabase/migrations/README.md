# Database migrations

These SQL files are a partial history of changes made to the Supabase
database. They are **not** a complete description of the schema: the core
tables (`employees`, `leave_requests`, `documents`, `users`, `leave_types`)
were created outside these files, and the files were applied by hand in the
Supabase SQL editor rather than with the Supabase CLI.

Exact duplicates of other files in this folder were removed. Nothing here is
run automatically, so removing a file does not change the live database.

Known leftovers, kept for the record:

- `leave_allocation_periods` / `leave_allocations` (20240422, 20240423,
  20240502): an allocations system the app no longer uses. Balances live on
  `employees.days_remaining` / `days_taken`.
- `reset_all_leave_balances` (20240429) refers to columns that don't exist and
  would fail if called. The app resets balances with a direct update instead
  (`app/api/leave-allocations/reset`).

The TypeScript description of the tables the app uses is in
`lib/database.types.ts`.
