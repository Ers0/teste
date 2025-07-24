import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

interface TransactionVolumeData {
  date: string;
  takeouts: number;
  returns: number;
  restocks: number;
}

const TransactionVolumeChart = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<TransactionVolumeData[], Error>({
    queryKey: ['transactionVolumeData', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_transaction_volume_data');
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <Skeleton className="h-[350px] w-full" />;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="takeouts" stroke="#ef4444" name={t('takeout')} />
        <Line type="monotone" dataKey="returns" stroke="#22c55e" name={t('return')} />
        <Line type="monotone" dataKey="restocks" stroke="#3b82f6" name={t('restock')} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default TransactionVolumeChart;