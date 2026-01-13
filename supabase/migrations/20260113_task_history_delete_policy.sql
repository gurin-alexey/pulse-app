-- Add policy to allow users to delete their own history items
CREATE POLICY "Users can delete history of their own tasks" ON public.task_history
    FOR DELETE USING (auth.uid() = user_id);
