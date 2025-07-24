import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';

interface Item {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number | null;
  critical_stock_threshold: number | null;
}

interface Notification {
  type: 'critical' | 'low';
  message: string;
  itemId: string;
}

const Notifications = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: items, isLoading } = useQuery<Item[], Error>({
    queryKey: ['itemsForNotifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('items')
        .select('id, name, quantity, low_stock_threshold, critical_stock_threshold')
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Refetch every 5 minutes
  });

  const notifications: Notification[] = (items || [])
    .map(item => {
      if (item.critical_stock_threshold !== null && item.quantity <= item.critical_stock_threshold) {
        return {
          type: 'critical',
          message: t('notification_critical_stock', { itemName: item.name, quantity: item.quantity }),
          itemId: item.id,
        };
      }
      if (item.low_stock_threshold !== null && item.critical_stock_threshold !== null && item.quantity <= item.low_stock_threshold && item.quantity > item.critical_stock_threshold) {
        return {
          type: 'low',
          message: t('notification_low_stock', { itemName: item.name, quantity: item.quantity }),
          itemId: item.id,
        };
      }
      return null;
    })
    .filter((notification): notification is Notification => notification !== null);

  const notificationCount = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {notificationCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card className="border-none shadow-none">
          <CardHeader className="p-4">
            <CardTitle>{t('notifications')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 max-h-96 overflow-y-auto">
            {isLoading ? (
              <p>{t('loading_notifications')}...</p>
            ) : notificationCount > 0 ? (
              <div className="space-y-4">
                {notifications.map((notification, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`mt-1 ${notification.type === 'critical' ? 'text-destructive' : 'text-amber-500'}`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {notification.type === 'critical' ? t('critical_stock_alert') : t('low_stock_warning')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <Link to="/inventory" className="hover:underline">
                          {notification.message}
                        </Link>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('no_new_notifications')}</p>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};

export default Notifications;