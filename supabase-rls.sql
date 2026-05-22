-- =============================================
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR
-- Setelah tabel (users, boards, tasks, reports) sudah dibuat
-- =============================================

-- =============================================
-- TABLES: board_members & board_shares
-- =============================================
CREATE TABLE IF NOT EXISTS public.board_members (
    board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (board_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.board_shares (
    token text PRIMARY KEY,
    board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz NULL
);

-- =============================================
-- TRIGGER: Auto-create users row on auth signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, name, email, password_hash, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'managed_by_supabase_auth',
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- TRIGGER: Auto-create default board for new user
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_board()
RETURNS trigger AS $$
DECLARE
    new_board_id uuid;
BEGIN
    INSERT INTO public.boards (name, description, owner_id)
    VALUES ('My Board', 'Default board', NEW.id)
    RETURNING id INTO new_board_id;

    INSERT INTO public.board_members (board_id, user_id, role)
    VALUES (new_board_id, NEW.id, 'owner');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_created_board ON public.users;
CREATE TRIGGER on_user_created_board
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_board();

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper: cek apakah user saat ini adalah admin
-- SECURITY DEFINER supaya bypass RLS (hindari infinite recursion)
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_board_owner(board_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = board_uuid AND owner_id = auth.uid() AND deleted_at IS NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_access_board(board_uuid uuid)
RETURNS boolean AS $$
  SELECT public.is_board_owner(board_uuid) OR EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = board_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_board_members(board_uuid uuid)
RETURNS TABLE (
    user_id uuid,
    name text,
    role text
) AS $$
    SELECT bm.user_id, u.name, bm.role
    FROM public.board_members bm
    JOIN public.users u ON u.id = bm.user_id
    WHERE bm.board_id = board_uuid
    ORDER BY bm.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_users_by_ids(user_ids uuid[])
RETURNS TABLE (
    id uuid,
    name text
) AS $$
    SELECT u.id, u.name
    FROM public.users u
    WHERE u.id = ANY(user_ids);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- RLS: users
-- =============================================
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- =============================================
-- RLS: boards
-- =============================================
DROP POLICY IF EXISTS "Users can read own boards" ON boards;
CREATE POLICY "Users can read own boards"
    ON boards FOR SELECT
    USING (public.can_access_board(id));

DROP POLICY IF EXISTS "Users can create boards" ON boards;
CREATE POLICY "Users can create boards"
    ON boards FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own boards" ON boards;
CREATE POLICY "Users can update own boards"
    ON boards FOR UPDATE
    USING (public.is_board_owner(id));

DROP POLICY IF EXISTS "Users can delete own boards" ON boards;
CREATE POLICY "Users can delete own boards"
    ON boards FOR DELETE
    USING (public.is_board_owner(id));

-- =============================================
-- RLS: board_members & board_shares
-- =============================================
DROP POLICY IF EXISTS "Board members can read membership" ON board_members;
CREATE POLICY "Board members can read membership"
    ON board_members FOR SELECT
    USING (public.can_access_board(board_id));

DROP POLICY IF EXISTS "Board owners can manage members" ON board_members;
CREATE POLICY "Board owners can manage members"
    ON board_members FOR INSERT
    WITH CHECK (public.is_board_owner(board_id) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Board owners can update members" ON board_members;
CREATE POLICY "Board owners can update members"
    ON board_members FOR UPDATE
    USING (public.is_board_owner(board_id));

DROP POLICY IF EXISTS "Board owners can delete members" ON board_members;
CREATE POLICY "Board owners can delete members"
    ON board_members FOR DELETE
    USING (public.is_board_owner(board_id));

DROP POLICY IF EXISTS "Board owners can create share links" ON board_shares;
CREATE POLICY "Board owners can create share links"
    ON board_shares FOR INSERT
    WITH CHECK (public.is_board_owner(board_id));

DROP POLICY IF EXISTS "Board owners can read share links" ON board_shares;
CREATE POLICY "Board owners can read share links"
    ON board_shares FOR SELECT
    USING (public.is_board_owner(board_id));

CREATE OR REPLACE FUNCTION public.accept_board_share(share_token text)
RETURNS uuid AS $$
DECLARE
    target_board_id uuid;
BEGIN
    SELECT bs.board_id
    INTO target_board_id
    FROM public.board_shares bs
    INNER JOIN public.boards b ON b.id = bs.board_id
    WHERE bs.token = share_token
      AND bs.revoked_at IS NULL
      AND b.deleted_at IS NULL
    LIMIT 1;

    IF target_board_id IS NULL THEN
        RAISE EXCEPTION 'Share link is invalid or expired';
    END IF;

    INSERT INTO public.board_members (board_id, user_id, role)
    VALUES (target_board_id, auth.uid(), 'member')
    ON CONFLICT (board_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

    RETURN target_board_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

INSERT INTO public.board_members (board_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM public.boards
ON CONFLICT (board_id, user_id) DO NOTHING;

-- =============================================
-- RLS: tasks
-- =============================================
DROP POLICY IF EXISTS "Users can read tasks in own boards" ON tasks;
CREATE POLICY "Users can read tasks in own boards"
    ON tasks FOR SELECT
    USING (
        deleted_at IS NULL
        AND public.can_access_board(board_id)
    );

DROP POLICY IF EXISTS "Users can create tasks in own boards" ON tasks;
CREATE POLICY "Users can create tasks in own boards"
    ON tasks FOR INSERT
    WITH CHECK (
        public.can_access_board(board_id)
    );

DROP POLICY IF EXISTS "Users can update tasks in own boards" ON tasks;
CREATE POLICY "Users can update tasks in own boards"
    ON tasks FOR UPDATE
    USING (
        public.can_access_board(board_id)
    );

DROP POLICY IF EXISTS "Users can delete tasks in own boards" ON tasks;
CREATE POLICY "Users can delete tasks in own boards"
    ON tasks FOR DELETE
    USING (
        public.can_access_board(board_id)
    );

-- =============================================
-- RLS: reports
-- =============================================
DROP POLICY IF EXISTS "Users can read own reports" ON reports;
CREATE POLICY "Users can read own reports"
    ON reports FOR SELECT
    USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can create reports" ON reports;
CREATE POLICY "Users can create reports"
    ON reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can update own reports" ON reports;
CREATE POLICY "Users can update own reports"
    ON reports FOR UPDATE
    USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can read all reports" ON reports;
CREATE POLICY "Admins can read all reports"
    ON reports FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all reports" ON reports;
CREATE POLICY "Admins can update all reports"
    ON reports FOR UPDATE
    USING (public.is_admin());

-- =============================================
-- RLS: Admin — akses ke semua data
-- =============================================
DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
    ON users FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all users" ON users;
CREATE POLICY "Admins can update all users"
    ON users FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users"
    ON users FOR DELETE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all boards" ON boards;
CREATE POLICY "Admins can read all boards"
    ON boards FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all tasks" ON tasks;
CREATE POLICY "Admins can read all tasks"
    ON tasks FOR SELECT
    USING (public.is_admin());
