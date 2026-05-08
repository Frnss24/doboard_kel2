-- =============================================
-- JALANKAN SQL INI DI SUPABASE SQL EDITOR
-- Setelah tabel (users, boards, tasks, reports) sudah dibuat
-- =============================================

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
BEGIN
    INSERT INTO public.boards (name, description, owner_id)
    VALUES ('My Board', 'Default board', NEW.id);
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

-- =============================================
-- RLS: users
-- =============================================
-- User bisa baca profil sendiri
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- User bisa update profil sendiri
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- =============================================
-- RLS: boards
-- =============================================
-- User bisa lihat board miliknya (yang belum dihapus)
DROP POLICY IF EXISTS "Users can read own boards" ON boards;
CREATE POLICY "Users can read own boards"
    ON boards FOR SELECT
    USING (auth.uid() = owner_id AND deleted_at IS NULL);

-- User bisa buat board baru
DROP POLICY IF EXISTS "Users can create boards" ON boards;
CREATE POLICY "Users can create boards"
    ON boards FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- User bisa update board miliknya
DROP POLICY IF EXISTS "Users can update own boards" ON boards;
CREATE POLICY "Users can update own boards"
    ON boards FOR UPDATE
    USING (auth.uid() = owner_id);

-- User bisa hapus board miliknya
DROP POLICY IF EXISTS "Users can delete own boards" ON boards;
CREATE POLICY "Users can delete own boards"
    ON boards FOR DELETE
    USING (auth.uid() = owner_id);

-- =============================================
-- RLS: tasks
-- =============================================
-- User bisa lihat task di board miliknya
DROP POLICY IF EXISTS "Users can read tasks in own boards" ON tasks;
CREATE POLICY "Users can read tasks in own boards"
    ON tasks FOR SELECT
    USING (
        deleted_at IS NULL
        AND board_id IN (
            SELECT id FROM boards WHERE owner_id = auth.uid() AND deleted_at IS NULL
        )
    );

-- User bisa buat task di board miliknya
DROP POLICY IF EXISTS "Users can create tasks in own boards" ON tasks;
CREATE POLICY "Users can create tasks in own boards"
    ON tasks FOR INSERT
    WITH CHECK (
        board_id IN (
            SELECT id FROM boards WHERE owner_id = auth.uid() AND deleted_at IS NULL
        )
    );

-- User bisa update task di board miliknya
DROP POLICY IF EXISTS "Users can update tasks in own boards" ON tasks;
CREATE POLICY "Users can update tasks in own boards"
    ON tasks FOR UPDATE
    USING (
        board_id IN (
            SELECT id FROM boards WHERE owner_id = auth.uid() AND deleted_at IS NULL
        )
    );

-- User bisa hapus task di board miliknya
DROP POLICY IF EXISTS "Users can delete tasks in own boards" ON tasks;
CREATE POLICY "Users can delete tasks in own boards"
    ON tasks FOR DELETE
    USING (
        board_id IN (
            SELECT id FROM boards WHERE owner_id = auth.uid() AND deleted_at IS NULL
        )
    );

-- =============================================
-- RLS: reports
-- =============================================
-- User bisa lihat report yang dia buat
DROP POLICY IF EXISTS "Users can read own reports" ON reports;
CREATE POLICY "Users can read own reports"
    ON reports FOR SELECT
    USING (auth.uid() = reporter_id);

-- User bisa buat report baru
DROP POLICY IF EXISTS "Users can create reports" ON reports;
CREATE POLICY "Users can create reports"
    ON reports FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

-- User bisa update report sendiri
DROP POLICY IF EXISTS "Users can update own reports" ON reports;
CREATE POLICY "Users can update own reports"
    ON reports FOR UPDATE
    USING (auth.uid() = reporter_id);

-- Admin bisa lihat semua report
DROP POLICY IF EXISTS "Admins can read all reports" ON reports;
CREATE POLICY "Admins can read all reports"
    ON reports FOR SELECT
    USING (public.is_admin());

-- Admin bisa update semua report (decision_note, status)
DROP POLICY IF EXISTS "Admins can update all reports" ON reports;
CREATE POLICY "Admins can update all reports"
    ON reports FOR UPDATE
    USING (public.is_admin());

-- =============================================
-- RLS: Admin — akses ke semua data
-- =============================================
-- Admin bisa lihat semua users
DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
    ON users FOR SELECT
    USING (public.is_admin());

-- Admin bisa update semua users (ganti role, dll)
DROP POLICY IF EXISTS "Admins can update all users" ON users;
CREATE POLICY "Admins can update all users"
    ON users FOR UPDATE
    USING (public.is_admin());

-- Admin bisa delete users
DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users"
    ON users FOR DELETE
    USING (public.is_admin());

-- Admin bisa lihat semua boards (untuk stats)
DROP POLICY IF EXISTS "Admins can read all boards" ON boards;
CREATE POLICY "Admins can read all boards"
    ON boards FOR SELECT
    USING (public.is_admin());

-- Admin bisa lihat semua tasks (untuk stats)
DROP POLICY IF EXISTS "Admins can read all tasks" ON tasks;
CREATE POLICY "Admins can read all tasks"
    ON tasks FOR SELECT
    USING (public.is_admin());
