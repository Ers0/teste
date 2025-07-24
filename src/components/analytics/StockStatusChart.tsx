import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface Item {
  quantity: number;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
}

const StockStatusChart = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: items, isLoading } = useQuery<Item[], Error>({
    queryKey: ['allItemsForStockStatus', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('items').select('quantity, low_stock_threshold, critical_stock_threshold').eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });

  const chartData = useMemo(() => {
    if (!items) return [];
    
    const statusCounts = {
      critical: 0,
      low: 0,
      ok: 0,
    };

    items.forEach(item => {
      if (item.critical_stock_threshold !== null && item.quantity <= item.critical_stock_threshold) {
        statusCounts.critical++;
      } else if (item.low_stock_threshold !== null && item.quantity <= item.low_stock_threshold) {
        statusCounts.low++;
      } else {
        statusCounts.ok++;
      }
    });

    return [
      { name: t('stock_ok'), value: statusCounts.ok },
      { name: t('stock_low'), value: statusCounts.low },
      { name: t('stock_critical'), value: statusCounts.critical },
    ];
  }, [items, t]);

  const COLORS = ['#00C49F', '#FFBB28', '#FF8042'];

  if (isLoading) {
    return <Skeleton className="h-[350px] w-full" />;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default StockStatusChart;