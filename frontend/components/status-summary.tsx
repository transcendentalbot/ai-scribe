'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatusSummaryProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'gray';
}

const colorConfig = {
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-900',
  },
  green: {
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    textColor: 'text-green-900',
  },
  yellow: {
    bg: 'bg-yellow-50',
    iconBg: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    textColor: 'text-yellow-900',
  },
  gray: {
    bg: 'bg-gray-50',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    textColor: 'text-gray-900',
  },
};

export function StatusSummary({ title, value, icon, color }: StatusSummaryProps) {
  const config = colorConfig[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative overflow-hidden rounded-lg p-6',
        config.bg
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={cn('text-3xl font-bold mt-2', config.textColor)}>
            {value}
          </p>
        </div>
        <div className={cn(
          'p-3 rounded-full',
          config.iconBg,
          config.iconColor
        )}>
          {icon}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </motion.div>
  );
}