import { createClient } from './client'

export async function uploadImage(file: File, bucket: string, path: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true })
  if (error) { console.error('Upload error:', error); return null }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return publicUrl
}

export function generateImagePath(prefix: string, fileName: string) {
  const ext = fileName.split('.').pop()
  return `${prefix}/${Date.now()}.${ext}`
}
