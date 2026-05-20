import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface RaahiLogoProps {
    size?: number;
}

const RaahiLogo: React.FC<RaahiLogoProps> = ({ size = 42 }) => {
    // For Web, we can use SVG directly in a more flexible way
    // For native, we'd normally need react-native-svg, but since we are specifically
    // trying to achieve seamlessness on Web (npm run web), we can use a simpler approach
    
    return (
        <View style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" width={size} height={size}>
                <defs>
                    <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#5B4FFF', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#00BFFF', stopOpacity: 1 }} />
                    </linearGradient>
                </defs>
                
                {/* Border Circle */}
                <circle cx="50" cy="50" r="46" fill="none" stroke="url(#logoGradient)" strokeWidth="4" />
                
                {/* Winding Road */}
                <path 
                    d="M 50 85 C 30 65 70 35 50 15" 
                    fill="none" 
                    stroke="url(#logoGradient)" 
                    strokeWidth="14" 
                    strokeLinecap="round" 
                />
                
                {/* Dashed Lines on Road */}
                <path 
                    d="M 50 85 C 30 65 70 35 50 15" 
                    fill="none" 
                    stroke="rgba(255,255,255,0.7)" 
                    strokeWidth="1.5" 
                    strokeDasharray="4,6" 
                    strokeLinecap="round" 
                />
                
                {/* Car Silhouette (More Accurate to original) */}
                <g transform="translate(56, 42) rotate(-18)">
                    <path 
                        d="M 2 8 C 1 8 0 9 0 10 L 0 14 C 0 15 1 16 2 16 L 3 16 L 3 17 C 3 18 4 19 5 19 C 6 19 7 18 7 17 L 13 17 L 13 18 C 13 19 14 20 15 20 C 16 20 17 19 17 18 L 17 16 L 18 16 C 19 16 20 15 20 14 L 20 10 C 20 9 19 8 18 8 L 16 8 L 14 4 C 13 3 12 2 11 2 L 6 2 C 5 2 4 3 3 4 L 1 8" 
                        fill="#00BFFF" 
                    />
                    <path 
                        d="M 5 4 L 11 4 L 13 8 L 3 8 L 5 4" 
                        fill="#FFFFFF" 
                        opacity="0.6" 
                    />
                </g>
                
                {/* Location Pin */}
                <g transform="translate(42, 5)">
                    <path 
                        d="M 8 0 C 4 0 0 4 0 8 C 0 14 8 20 8 20 C 8 20 16 14 16 8 C 16 4 12 0 8 0 Z" 
                        fill="#5B4FFF" 
                    />
                    <circle cx="8" cy="8" r="3.5" fill="#FFFFFF" />
                </g>
            </svg>
        </View>
    );
};

export default RaahiLogo;
