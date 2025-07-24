import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

interface ItemMovementData {
  name: string;
  total_movement: number;
}

const ItemMovementChart = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<ItemMovementData[], Error>({
    queryKey: ['itemMovementData', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.rpc('get_item_movement_chart_data');
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
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="total_movement" fill="#8884d8" name={t('total_takeouts')} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ItemMovementChart;