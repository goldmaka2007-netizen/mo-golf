import React from 'react';
import { motion } from 'framer-motion';

interface SettingsImportExportPanelProps { children: React.ReactNode; }
export const SettingsImportExportPanel = React.memo(({ children }: SettingsImportExportPanelProps) => <motion.div key="import" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">{children}</motion.div>);
