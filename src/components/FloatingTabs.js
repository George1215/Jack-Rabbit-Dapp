// src/components/FloatingTabs.js
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../styles/FloatingTabs.module.css';

import carrot from '../assets/carrot.png';
import paw from '../assets/paw.png';

export default function FloatingTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className={styles.tabWrapper}>
      <img
        src={carrot}
        alt="Diamond"
        title="Diamond"
        className={`${styles.tabIcon} ${location.pathname === '/diamond' ? styles.activeTab : ''}`}
        onClick={() => navigate('/diamond')}
      />
      <img
        src={paw}
        alt="Jackies"
        title="Jackies"
        className={`${styles.tabIcon} ${location.pathname === '/jackies' ? styles.activeTab : ''}`}
        onClick={() => navigate('/jackies')}
      />
    </div>
  );
}
