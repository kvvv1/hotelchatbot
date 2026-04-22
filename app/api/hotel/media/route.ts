import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MEDIA_BUCKET = 'hotel-media'

type HotelContext =
  | {
      admin: ReturnType<typeof createAdminClient>
      hotelId: string
    }
  | {
      response: NextResponse
    }

function normalizeText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length > 0 ? text : null
}

function isBucketMissing(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return message.includes('bucket not found') || message.includes('not found') || String(error.statusCode || '') === '404'
}

function isBucketAlreadyExists(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return message.includes('already exists') || String(error.statusCode || '') === '409'
}

async function getHotelContext(): Promise<HotelContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('hotel_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.hotel_id) {
    return { response: NextResponse.json({ error: 'Perfil sem hotel vinculado.' }, { status: 400 }) }
  }

  return { admin, hotelId: profile.hotel_id }
}

async function ensureMediaBucket(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  const { data: bucket, error: getBucketError } = await admin.storage.getBucket(MEDIA_BUCKET)

  if (getBucketError) {
    if (!isBucketMissing(getBucketError)) {
      throw new Error(getBucketError.message)
    }

    const { error: createBucketError } = await admin.storage.createBucket(MEDIA_BUCKET, { public: true })
    if (createBucketError && !isBucketAlreadyExists(createBucketError)) {
      throw new Error(createBucketError.message)
    }
    return
  }

  if (!bucket.public) {
    const { error: updateBucketError } = await admin.storage.updateBucket(MEDIA_BUCKET, { public: true })
    if (updateBucketError) {
      throw new Error(updateBucketError.message)
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const context = await getHotelContext()
    if ('response' in context) return context.response

    const { admin, hotelId } = context
    const formData = await req.formData()
    const fileEntry = formData.get('file')

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'Arquivo invalido.' }, { status: 400 })
    }

    if (!fileEntry.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Envie apenas imagens.' }, { status: 400 })
    }

    await ensureMediaBucket(admin)

    const category = normalizeText(formData.get('category')) || 'general'
    const caption = normalizeText(formData.get('caption'))
    const rawExtension = fileEntry.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExtension = rawExtension.replace(/[^a-z0-9]/g, '') || 'jpg'
    const storagePath = `${hotelId}/${category}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`

    const { error: uploadError } = await admin.storage.from(MEDIA_BUCKET).upload(storagePath, fileEntry, {
      contentType: fileEntry.type,
      upsert: false,
    })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath)

    const { data: item, error: insertError } = await admin
      .from('hotel_media')
      .insert({
        hotel_id: hotelId,
        url: publicUrl,
        storage_path: storagePath,
        category,
        caption,
      })
      .select('*')
      .single()

    if (insertError || !item) {
      await admin.storage.from(MEDIA_BUCKET).remove([storagePath])
      return NextResponse.json(
        { error: insertError?.message || 'Nao foi possivel salvar a foto.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, item })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const context = await getHotelContext()
    if ('response' in context) return context.response

    const { admin, hotelId } = context
    const body = await req.json().catch(() => ({}))
    const mediaId = typeof body.id === 'string' ? body.id.trim() : ''

    if (!mediaId) {
      return NextResponse.json({ error: 'Foto invalida.' }, { status: 400 })
    }

    const { data: item, error: itemError } = await admin
      .from('hotel_media')
      .select('id,storage_path')
      .eq('id', mediaId)
      .eq('hotel_id', hotelId)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Foto nao encontrada.' }, { status: 404 })
    }

    if (item.storage_path) {
      const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove([item.storage_path])
      if (removeError && !isBucketMissing(removeError)) {
        console.error('[hotel media] storage delete error:', removeError)
      }
    }

    const { error: deleteError } = await admin
      .from('hotel_media')
      .delete()
      .eq('id', item.id)
      .eq('hotel_id', hotelId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}
