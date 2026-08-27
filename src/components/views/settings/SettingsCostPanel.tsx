import React from 'react';
import { motion } from 'framer-motion';

interface SettingsCostPanelProps { children: React.ReactNode; }
export const SettingsCostPanel = React.memo(({ children }: SettingsCostPanelProps) => <motion.div key="cost" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4" dir="rtl">{children}</motion.div>);
