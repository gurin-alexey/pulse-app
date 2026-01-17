import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

/**
 * Compresses and uploads an image to Supabase Storage.
 * @param file The file object to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(file: File): Promise<string | null> {
    try {
        // 1. Compress the image
        // Options: max 1920px width/height, max 1MB size, use WebWorker
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            fileType: 'image/webp' // Convert to WebP for better compression
        };

        const compressedFile = await imageCompression(file, options);

        // Log compression result for debugging/info
        console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

        // 2. Generate a unique file path
        // folder/timestamp_random.webp
        const fileExt = 'webp';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        // 3. Upload to Supabase
        const { error: uploadError } = await supabase.storage
            .from('task-assets')
            .upload(filePath, compressedFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            toast.error('Failed to upload image');
            return null;
        }

        // 4. Get Public URL
        const { data } = supabase.storage
            .from('task-assets')
            .getPublicUrl(filePath);

        return data.publicUrl;

    } catch (error) {
        console.error('Image processing error:', error);
        toast.error('Failed to process image');
        return null;
    }
}
