import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PatientHome from './pages/patient/PatientHome';
import RegisterTest from './pages/patient/RegisterTest';
import RegistrationSuccess from './pages/patient/RegistrationSuccess';
import TrackTest from './pages/patient/TrackTest';
import StaffLogin from './pages/staff/StaffLogin';
import StaffDashboard from './pages/staff/StaffDashboard';
import CurrentTest from './pages/staff/CurrentTest';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

function AppContent() {
  const { user } = useAuth();
  const [currentSection, setCurrentSection] = useState('home'); // 'home' | 'patient' | 'staff' | 'admin'

  // Patient Sub-view State
  const [patientView, setPatientView] = useState('home'); // 'home' | 'register' | 'success' | 'track'
  const [registrationData, setRegistrationData] = useState(null);
  const [trackInitialId, setTrackInitialId] = useState('');

  // Staff Sub-view State
  const [activeStaffTest, setActiveStaffTest] = useState(null);

  const handlePatientNavigate = (view) => {
    setPatientView(view);
    setCurrentSection('patient');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <Navbar currentSection={currentSection} setCurrentSection={setCurrentSection} />

      <main className="flex-1">
        {/* 1. HOME PAGE */}
        {currentSection === 'home' && (
          <Home
            onNavigate={(sec) => {
              if (sec === 'patient') {
                setPatientView('home');
                setCurrentSection('patient');
              } else {
                setCurrentSection(sec);
              }
            }}
          />
        )}

        {/* 2. PATIENT PORTAL */}
        {currentSection === 'patient' && (
          <>
            {patientView === 'home' && (
              <PatientHome
                onSelectOption={(option) => {
                  if (option === 'register') setPatientView('register');
                  if (option === 'track') {
                    setTrackInitialId('');
                    setPatientView('track');
                  }
                }}
              />
            )}

            {patientView === 'register' && (
              <RegisterTest
                onBack={() => setPatientView('home')}
                onSuccess={(data) => {
                  setRegistrationData(data);
                  setPatientView('success');
                }}
              />
            )}

            {patientView === 'success' && registrationData && (
              <RegistrationSuccess
                registrationData={registrationData}
                onTrackThisTest={(trackingId) => {
                  setTrackInitialId(trackingId);
                  setPatientView('track');
                }}
                onRegisterAnother={() => setPatientView('register')}
              />
            )}

            {patientView === 'track' && (
              <TrackTest
                initialTrackingId={trackInitialId}
                onBack={() => setPatientView('home')}
              />
            )}
          </>
        )}

        {/* 3. LABORATORY STAFF PORTAL */}
        {currentSection === 'staff' && (
          <>
            {!user || user.role !== 'staff' ? (
              <StaffLogin onLoginSuccess={() => setCurrentSection('staff')} />
            ) : activeStaffTest ? (
              <CurrentTest
                test={activeStaffTest}
                onBack={() => setActiveStaffTest(null)}
                onCompleted={() => setActiveStaffTest(null)}
              />
            ) : (
              <StaffDashboard
                onOpenCurrentTest={(test) => setActiveStaffTest(test)}
              />
            )}
          </>
        )}

        {/* 4. ADMIN DASHBOARD */}
        {currentSection === 'admin' && (
          <>
            {!user || user.role !== 'admin' ? (
              <AdminLogin onLoginSuccess={() => setCurrentSection('admin')} />
            ) : (
              <AdminDashboard />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400">
        LabFlow — Smart Laboratory Test Management System • Enterprise IT Standard v1.0.0
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
