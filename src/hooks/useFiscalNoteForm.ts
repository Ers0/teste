import { useState } from 'react';
import { useAuth } from '@/integrations/supabase/auth';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db';
import { FiscalNote } from '@/types';
import { showError, showSuccess } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

export const useFiscalNoteForm = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  const [nfeKey, setNfeKey] = useState('');
  const [description, setDescription] = useState('');
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(undefined);
  const [photo, setPhoto] = useState<File | null>(null);

  const resetForm = () => {
    setNfeKey('');
    setDescription('');
    setArrivalDate(undefined);
    setPhoto(null);
  };

  const uploadPhoto = async (file: File, fiscalNoteId: string) => {
    if (!file || !user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${fiscalNoteId}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;
    const { error } = await supabase.storage.from('fiscal-note-photos').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) {
      showError(t('error_uploading_photo') + error.message);
      return null;
    }
    const { data } = supabase.storage.from('fiscal-note-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSaveFiscalNote = async () => {
    if (!nfeKey) {
      showError(t('enter_nfe_key_scan'));
      return;
    }
    if (!user) {
      showError(t('user_not_authenticated_login'));
      return;
    }
    const existingNote = await db.fiscal_notes.where('nfe_key').equals(nfeKey).first();
    if (existingNote) {
      showError(t('fiscal_note_already_exists'));
      return;
    }

    let photoUrl = null;
    if (isOnline && photo) {
      photoUrl = await uploadPhoto(photo, uuidv4());
    } else if (!isOnline && photo) {
      showError("Photo upload is not available offline.");
    }

    const newNote: FiscalNote = {
      id: uuidv4(),
      nfe_key: nfeKey,
      description: description.trim() || null,
      arrival_date: arrivalDate ? arrivalDate.toISOString() : null,
      user_id: user.id,
      created_at: new Date().toISOString(),
      photo_url: photoUrl,
    };

    try {
      await db.fiscal_notes.add(newNote);
      await db.outbox.add({ type: 'create', table: 'fiscal_notes', payload: newNote, timestamp: Date.now() });
      showSuccess(t('fiscal_note_saved_locally'));
      resetForm();
    } catch (error: any) {
      showError(t('error_saving_fiscal_note') + error.message);
    }
  };

  return {
    nfeKey,
    setNfeKey,
    description,
    setDescription,
    arrivalDate,
    setArrivalDate,
    photo,
    setPhoto,
    handleSaveFiscalNote,
  };
};