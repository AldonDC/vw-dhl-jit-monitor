import React, { useState } from 'react';
import { Upload, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ExcelUpload: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
    const [fileName, setFileName] = useState<string | null>(null);

    const handleUpload = () => {
        setStatus('uploading');
        setFileName('BESI_JIS_AKSYS_CW09.xlsx');
        // Simulate upload delay
        setTimeout(() => {
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        }, 2000);
    };

    return (
        <div className="relative">
            <AnimatePresence mode="wait">
                {status === 'idle' ? (
                    <motion.button
                        key="idle"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        onClick={handleUpload}
                        className="flex items-center gap-3 px-6 py-3 bg-[var(--accent-color)] text-white text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-transform duration-200 focus-ring group"
                    >
                        <Upload size={18} className="group-hover:-translate-y-1 transition-transform" />
                        Importar Excel JIT
                    </motion.button>
                ) : status === 'uploading' ? (
                    <motion.div
                        key="uploading"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3 px-6 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-600 text-[11px] font-black uppercase rounded-2xl"
                    >
                        <Loader2 size={18} className="animate-spin" />
                        Procesando {fileName}...
                    </motion.div>
                ) : (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-3 px-6 py-3 bg-emerald-500 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-emerald-500/20"
                    >
                        <Check size={18} />
                        ¡BESI JIS Actualizado!
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
