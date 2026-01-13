-- Create task_history table
CREATE TABLE IF NOT EXISTS public.task_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_record JSONB,
    new_record JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view history of their own tasks" ON public.task_history
    FOR SELECT USING (auth.uid() = user_id);

-- Function to handle task history
CREATE OR REPLACE FUNCTION public.handle_task_history()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields JSONB;
    old_data JSONB;
    new_data JSONB;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Calculate changed fields
        SELECT jsonb_agg(key)
        INTO changed_fields
        FROM jsonb_each(to_jsonb(NEW)) n(key, value)
        JOIN jsonb_each(to_jsonb(OLD)) o(key, value) USING (key)
        WHERE n.value IS DISTINCT FROM o.value;
        
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        old_data := to_jsonb(OLD);
        new_data := null;
        changed_fields := null;
    ELSIF (TG_OP = 'INSERT') THEN
        old_data := null;
        new_data := to_jsonb(NEW);
        changed_fields := null;
    END IF;

    INSERT INTO public.task_history (task_id, user_id, operation, old_record, new_record, changed_fields)
    VALUES (
        COALESCE(NEW.id, OLD.id),
        auth.uid(),
        TG_OP,
        old_data,
        new_data,
        changed_fields
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_task_history ON public.tasks;
CREATE TRIGGER on_task_history
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.handle_task_history();
