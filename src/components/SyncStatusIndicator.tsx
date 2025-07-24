import React from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useSync } from '@/providers/SyncProvider';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const SyncStatusIndicator = () => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { isSyncing, syncData } = useSync();

  const getStatus = () => {
    if (isSyncing) {
      return {
        icon: <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />,
        text: t('syncing'),
        textColor: 'text-blue-500',
      };
    }
    if (isOnline) {
      return {
        icon: <Wifi className="h-4 w-4 text-green-500" />,
        text: t('online'),
        textColor: 'text-green-500',
      };
    }
    return {
      icon: <WifiOff className="h-4 w-4 text-red-500" />,
      text: t('offline'),
      textColor: 'text-red-500',
    };
  };

  const { icon, text, textColor } = getStatus();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="p-2 shadow-lg">
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-xs font-medium ${textColor}`}>{text}</span>
          {isOnline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={syncData}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('sync_now')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SyncStatusIndicator;