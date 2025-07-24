import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ItemMovementChart from '@/components/analytics/ItemMovementChart';
import TransactionVolumeChart from '@/components/analytics/TransactionVolumeChart';
import StockStatusChart from '@/components/analytics/StockStatusChart';

const Analytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('analytics_dashboard')}</h1>
            <p className="text-muted-foreground">{t('analytics_subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('item_movement_chart_title')}</CardTitle>
              <CardDescription>{t('item_movement_chart_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemMovementChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('transaction_volume_title')}</CardTitle>
              <CardDescription>{t('transaction_volume_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionVolumeChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('stock_status_title')}</CardTitle>
              <CardDescription>{t('stock_status_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <StockStatusChart />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;