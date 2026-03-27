import React, { createContext, useContext, useState } from 'react';

interface User {

    phone_number: string;
    name: string;
    role: string;
}

interface AuthContextType {
    token: string | null;
    user: User | null;
    setToken: (token: string | null) => void;
    setUser: (user: User | null) => void;
    isAuthenticated: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    token: null,
    user: null,
    setToken: () => { },
    setUser: () => { },
    isAuthenticated: false,
    logout: () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                setToken,
                setUser,
                isAuthenticated: !!token,
                logout,
            }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

