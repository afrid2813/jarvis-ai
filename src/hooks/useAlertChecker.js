import { useEffect, useMemo, useRef } from 'react';

function isTriggered(alert, assets) {
  const asset = assets.find(item => item.symbol === alert.symbol);
  const currentPrice = Number(asset?.price);
  const threshold = Number(alert.price);
  if (!Number.isFinite(currentPrice) || !Number.isFinite(threshold)) return false;

  return alert.direction === 'above'
    ? currentPrice >= threshold
    : currentPrice <= threshold;
}

export function useAlertChecker({ alerts, assets }) {
  const seenRef = useRef(new Set());
  const triggeredAlerts = useMemo(() => alerts
    .map(alert => ({ alert, asset: assets.find(item => item.symbol === alert.symbol) }))
    .filter(({ alert }) => isTriggered(alert, assets)), [alerts, assets]);

  useEffect(() => {
    alerts.forEach((alert, index) => {
      const key = `${index}:${alert.symbol}:${alert.direction}:${alert.price}`;
      const triggered = isTriggered(alert, assets);

      if (triggered && !seenRef.current.has(key)) {
        seenRef.current.add(key);
        console.log('Alert triggered:', alert);
      } else if (!triggered) {
        seenRef.current.delete(key);
      }
    });
  }, [alerts, assets]);

  return triggeredAlerts;
}
