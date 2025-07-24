import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

interface ItemMovementData {
  name: string;
  takeouts: number;
  returns: number;
}

const DashboardItemMovementChart = () => {
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
    return <Skeleton className="h-[200px] w-full" />;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <XAxis 
          dataKey="name" 
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip 
          cursor={{fill: 'transparent'}}
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
          }}
        />
        <Bar dataKey="takeouts" fill="#ef4444" name={t('takeout')} radius={[4, 4, 0, 0]} />
        <Bar dataKey="returns" fill="#22c55e" name={t('return')} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default DashboardItemMovementChart;