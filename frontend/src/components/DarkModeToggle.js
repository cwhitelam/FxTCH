import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import './DarkModeToggle.css';

const DarkModeToggle = ({ darkMode, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="theme-toggle"
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {darkMode ? <FiSun /> : <FiMoon />}
    </button>
  );
};

export default DarkModeToggle; 