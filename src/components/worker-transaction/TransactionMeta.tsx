import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

interface TransactionMetaProps {
  authorizedBy: string;
  onAuthorizedByChange: (value: string) => void;
  givenBy: string;
  onGivenByChange: (value: string) => void;
  applicationLocation: string;
  onApplicationLocationChange: (value: string) => void;
}

const TransactionMeta: React.FC<TransactionMetaProps> = ({
  authorizedBy, onAuthorizedByChange, givenBy, onGivenByChange,
  applicationLocation, onApplicationLocationChange
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 border-b pb-4">
      <h3 className="text-lg font-semibold">{t('transaction_details')}</h3>
      <div className="space-y-2">
        <Label htmlFor="authorizedBy">{t('authorized_by')}</Label>
        <Input id="authorizedBy" type="text" placeholder={t('enter_authorizer_name')} value={authorizedBy} onChange={(e) => onAuthorizedByChange(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="givenBy">{t('given_by')}</Label>
        <Input id="givenBy" type="text" placeholder={t('enter_giver_name')} value={givenBy} onChange={(e) => onGivenByChange(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="applicationLocation">{t('application_location')}</Label>
        <Input id="applicationLocation" type="text" placeholder={t('enter_application_location')} value={applicationLocation} onChange={(e) => onApplicationLocationChange(e.target.value)} />
      </div>
    </div>
  );
};

export default TransactionMeta;