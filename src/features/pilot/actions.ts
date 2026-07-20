'use server';

import { revalidatePath } from 'next/cache';

import {
  addPilotAssociationSchema,
  addPilotFeedbackSchema,
  type PilotActionState,
  reviewPilotFeedbackSchema,
  updatePilotAssociationSchema
} from '@/features/pilot/pilot-types';
import { requirePlatformAdmin } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const INITIAL_STATE: PilotActionState = { ok: true };
const PILOT_TARGET_MAX = 5;

function valueFromFormData(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function optionalValueFromFormData(formData: FormData, key: string): string | undefined {
  const value = valueFromFormData(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function optionalNumberFromFormData(formData: FormData, key: string): number | undefined {
  const value = valueFromFormData(formData, key).trim();
  if (value.length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function revalidatePilot(locale: 'en' | 'fr') {
  revalidatePath('/admin/pilot');
  revalidatePath(`/${locale}/admin/pilot`);
}

export async function addPilotAssociation(_previousState: PilotActionState = INITIAL_STATE, formData: FormData): Promise<PilotActionState> {
  const currentUser = await requirePlatformAdmin();
  const parsed = addPilotAssociationSchema.safeParse({
    associationId: valueFromFormData(formData, 'associationId'),
    locale: valueFromFormData(formData, 'locale'),
    notes: optionalValueFromFormData(formData, 'notes')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PL-001' };
  }

  const supabase = createSupabaseServerClient();
  const { count } = await supabase.from('pilot_associations').select('id', { count: 'exact', head: true });

  if ((count ?? 0) >= PILOT_TARGET_MAX) {
    return { ok: false, code: 'KMG-PL-409' };
  }

  const { error } = await supabase.from('pilot_associations').insert({
    association_id: parsed.data.associationId,
    created_by: currentUser.user.id,
    notes: parsed.data.notes ?? null
  });

  if (error) {
    if (error.code === '23505') {
      return { ok: false, code: 'KMG-PL-409' };
    }

    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePilot(parsed.data.locale);
  return { ok: true };
}

export async function updatePilotAssociation(_previousState: PilotActionState = INITIAL_STATE, formData: FormData): Promise<PilotActionState> {
  await requirePlatformAdmin();

  const parsed = updatePilotAssociationSchema.safeParse({
    dataMigrationStatus: valueFromFormData(formData, 'dataMigrationStatus'),
    guidedSetupStatus: valueFromFormData(formData, 'guidedSetupStatus'),
    locale: valueFromFormData(formData, 'locale'),
    notes: optionalValueFromFormData(formData, 'notes'),
    pilotAssociationId: valueFromFormData(formData, 'pilotAssociationId'),
    status: valueFromFormData(formData, 'status')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PL-001' };
  }

  const now = new Date().toISOString();
  const { error } = await createSupabaseServerClient()
    .from('pilot_associations')
    .update({
      data_migration_completed_at: parsed.data.dataMigrationStatus === 'completed' ? now : null,
      data_migration_status: parsed.data.dataMigrationStatus,
      guided_setup_status: parsed.data.guidedSetupStatus,
      notes: parsed.data.notes ?? null,
      setup_completed_at: parsed.data.guidedSetupStatus === 'completed' ? now : null,
      status: parsed.data.status
    })
    .eq('id', parsed.data.pilotAssociationId);

  if (error) {
    return { ok: false, code: error.code === 'PGRST116' ? 'KMG-PL-404' : 'KMG-SYS-000' };
  }

  revalidatePilot(parsed.data.locale);
  return { ok: true };
}

export async function addPilotFeedback(_previousState: PilotActionState = INITIAL_STATE, formData: FormData): Promise<PilotActionState> {
  const currentUser = await requirePlatformAdmin();
  const parsed = addPilotFeedbackSchema.safeParse({
    category: valueFromFormData(formData, 'category'),
    feedback: valueFromFormData(formData, 'feedback'),
    iterationNotes: optionalValueFromFormData(formData, 'iterationNotes'),
    locale: valueFromFormData(formData, 'locale'),
    pilotAssociationId: valueFromFormData(formData, 'pilotAssociationId'),
    rating: optionalNumberFromFormData(formData, 'rating')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PL-001' };
  }

  const { error } = await createSupabaseServerClient().from('pilot_feedback').insert({
    category: parsed.data.category,
    created_by: currentUser.user.id,
    feedback: parsed.data.feedback,
    iteration_notes: parsed.data.iterationNotes ?? null,
    pilot_association_id: parsed.data.pilotAssociationId,
    rating: parsed.data.rating ?? null
  });

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePilot(parsed.data.locale);
  return { ok: true };
}

export async function reviewPilotFeedback(_previousState: PilotActionState = INITIAL_STATE, formData: FormData): Promise<PilotActionState> {
  await requirePlatformAdmin();

  const parsed = reviewPilotFeedbackSchema.safeParse({
    feedbackId: valueFromFormData(formData, 'feedbackId'),
    locale: valueFromFormData(formData, 'locale')
  });

  if (!parsed.success) {
    return { ok: false, code: 'KMG-PL-001' };
  }

  const { error } = await createSupabaseServerClient()
    .from('pilot_feedback')
    .update({ reviewed_at: new Date().toISOString() })
    .eq('id', parsed.data.feedbackId);

  if (error) {
    return { ok: false, code: 'KMG-SYS-000' };
  }

  revalidatePilot(parsed.data.locale);
  return { ok: true };
}
