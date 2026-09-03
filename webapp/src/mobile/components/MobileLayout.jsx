import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNavBar from './BottomNavBar';
import '../styles/mobile.css';

const MobileLayout = () => {
    return (
        <div className="mobile-app-container">
            <Outlet />
            <BottomNavBar />
        </div>
    );
};

export default MobileLayout;
