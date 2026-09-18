import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Platform,
    Linking,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

interface LegalScreenProps {
    onClose?: () => void;
    initialTab?: 'terms' | 'privacy' | 'combined';
}

export const LegalScreen: React.FC<LegalScreenProps> = ({ onClose, initialTab = 'combined' }) => {
    const { colors, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'combined'>(initialTab);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardColor, borderBottomColor: colors.borderColor }]}>
                {onClose && (
                    <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
                        <Icon name="arrow-back" size={24} color={colors.textColor} />
                    </TouchableOpacity>
                )}
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.textColor }]}>Terms & Privacy Policy</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.accentColor }]}>GoRaahi Mountain Mobility LLP</Text>
                </View>
                {onClose && <View style={{ width: 40 }} />}
            </View>

            {/* Tab Selector */}
            <View style={[styles.tabBar, { backgroundColor: isDark ? '#121824' : '#F1F5F9', borderColor: colors.borderColor }]}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'combined' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setActiveTab('combined')}>
                    <Text style={[styles.tabText, { color: activeTab === 'combined' ? '#FFF' : colors.subtextColor }]}>All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'terms' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setActiveTab('terms')}>
                    <Text style={[styles.tabText, { color: activeTab === 'terms' ? '#FFF' : colors.subtextColor }]}>Terms & Conditions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'privacy' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setActiveTab('privacy')}>
                    <Text style={[styles.tabText, { color: activeTab === 'privacy' ? '#FFF' : colors.subtextColor }]}>Privacy Policy</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>

                {/* TERMS & CONDITIONS SECTION */}
                {(activeTab === 'terms' || activeTab === 'combined') && (
                    <View style={[styles.card, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <View style={styles.docHeader}>
                            <Text style={[styles.docTitle, { color: colors.textColor }]}>Terms & Conditions</Text>
                            <Text style={[styles.docMeta, { color: colors.accentColor }]}>Last Updated: 16 September 2026</Text>
                        </View>

                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Welcome to GoRaahi. These Terms and Conditions (“Terms”) govern your access to and use of the GoRaahi web application, mobile applications, and services (collectively, the “Service”), operated by GoRaahi Mountain Mobility LLP (“GoRaahi”, “we”, “us”, or “our”).
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            By registering for, accessing, or using GoRaahi, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our Service.
                        </Text>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>1. Platform Overview</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi is a mobility and technology platform designed to help passengers discover, request, and book local transportation services, and connect with independent drivers and fleet operators in mountainous and regional locations.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi acts solely as a technological intermediary connecting users. GoRaahi does not own, operate, or maintain transportation vehicles, nor does it employ drivers, unless explicitly stated otherwise in writing.
                        </Text>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>2. Eligibility & Account Creation</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• You must be at least 18 years old and legally capable of entering into binding contracts under applicable law.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• You are responsible for providing accurate, current, and complete information during registration.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Your mobile phone number is used for authentication. You are responsible for keeping your credentials secure.</Text>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>3. User Responsibilities & Conduct</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>When using GoRaahi, you agree that you will not:</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Engage in fraudulent, abusive, unlawful, threatening, or discriminatory behavior.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Misuse the booking platform or create fake requests.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Interfere with or compromise the operation, security, or integrity of the Service.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Transport illegal substances, hazardous materials, or dangerous goods.</Text>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>4. Driver & Operator Obligations</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>Drivers registering on GoRaahi represent and warrant that:</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• They possess a valid driving licence, commercial transport permits, vehicle registration, and active insurance.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• They maintain their vehicles in safe, roadworthy conditions suitable for mountain terrain.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• They obey all local traffic rules, safety regulations, and government mandates.</Text>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>5. Fare Estimates & Direct Payments</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Fare estimates shown on the platform are indicative and may vary based on route choice, demand, weather conditions, tolls, permits, or operator charges.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Passengers pay the driver directly for transportation bookings. GoRaahi does not process online payments or collect card/UPI credentials for rides at present.
                        </Text>

                        <View style={styles.noticeBox}>
                            <Text style={styles.noticeTitle}>⚠️ Mountain Region Notice</Text>
                            <Text style={styles.noticeText}>
                                Travel in mountainous and remote areas involves inherent environmental and logistical risks including sudden weather disruptions, landslides, road closures, mechanical failures, communication blackouts, and delays. Users and drivers agree to prioritize safety and follow official guidance at all times.
                            </Text>
                        </View>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>6. Limitation of Liability</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            To the maximum extent permitted by applicable law, GoRaahi Mountain Mobility LLP shall not be liable for indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of transportation services provided by third-party drivers.
                        </Text>

                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>7. Contact Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi Mountain Mobility LLP{'\n'}
                            Website: https://goraahi.in
                        </Text>
                    </View>
                )}

                {/* PRIVACY POLICY SECTION */}
                {(activeTab === 'privacy' || activeTab === 'combined') && (
                    <View style={[styles.card, { backgroundColor: colors.cardColor, borderColor: colors.borderColor }]}>
                        <View style={styles.docHeader}>
                            <Text style={[styles.docTitle, { color: colors.textColor }]}>Privacy Policy</Text>
                            <Text style={[styles.docMeta, { color: colors.accentColor }]}>Last Updated: 16 September 2026</Text>
                        </View>

                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi Mountain Mobility LLP (“GoRaahi”, “we”, “us”, or “our”) operates the GoRaahi web application and related services (collectively, the “Service”).
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi is a mobility and transportation platform designed to help passengers discover, request, and book local transportation services and connect with drivers.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            This Privacy Policy explains what information we collect, how we use it, how we protect it, and what choices you have regarding your information.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            By using GoRaahi, you acknowledge the practices described in this Privacy Policy.
                        </Text>

                        {/* 1. Information We Collect */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>1. Information We Collect</Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>1.1 Account and Contact Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>When you create or use a GoRaahi account, we may collect:</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Mobile phone number</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Name</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Email address, if provided</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Account and login information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Information you provide while contacting GoRaahi</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            Your mobile number may be used for account verification and OTP-based authentication.
                        </Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>1.2 Booking Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>When you search for or make a transportation booking, we may collect information such as:</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Pickup location</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Destination</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Travel date and time</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Selected route or vehicle</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Number of passengers</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Booking details</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Booking status</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Information required to communicate with the driver</Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>1.3 Location Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            With your permission, GoRaahi may collect or access your device’s location information.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Location information may be used to:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Help identify your pickup location</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Show relevant transportation services</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Improve route and booking functionality</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Help connect passengers with drivers</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Provide location-related features of the Service</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            You can control location permissions through your device or browser settings. Some features may not work correctly if location access is disabled.
                        </Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>1.4 Driver Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            If you register or apply as a driver, GoRaahi may collect additional information required for driver onboarding and verification, including:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Name</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Mobile number</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Address</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Vehicle information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Driving licence information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Vehicle registration information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Vehicle photographs</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Identity or verification documents</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Bank or settlement information where required for GoRaahi’s future services</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Other information necessary for driver verification and platform operations</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            Driver information may be reviewed for verification and safety purposes.
                        </Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>1.5 Device and Technical Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            When you access GoRaahi, we may automatically receive certain technical information, such as:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• IP address</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Browser type</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Device type</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Operating system</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Approximate location derived from technical information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Language and timezone settings</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Access times</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Pages or features accessed</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Error and diagnostic information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            This information helps us operate, secure, troubleshoot, and improve the Service.
                        </Text>

                        {/* 2. How We Use Your Information */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>2. How We Use Your Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>We may use information we collect to:</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Create and manage your account</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Verify your identity and phone number</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Process and manage bookings</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Connect passengers with drivers</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Provide transportation-related services</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Communicate booking information and service updates</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Provide customer support</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Verify and onboard drivers</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Detect and prevent fraud, abuse, or unauthorized activity</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Maintain the security of the Service</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Troubleshoot technical problems</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Improve our website, products, and services</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Analyze usage and platform performance</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Comply with applicable legal and regulatory requirements</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            We will use personal information only for legitimate business, service, security, legal, or operational purposes.
                        </Text>

                        {/* 3. Payments */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>3. Payments</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi currently does not process online payments for transportation bookings through the web application.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>At present:</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Passengers pay the driver directly.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• GoRaahi does not collect the passenger’s card, UPI, or other online payment credentials for the ride.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• GoRaahi does not act as the payment processor for these direct driver-passenger payments.</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Payment arrangements between a passenger and driver are subject to the applicable booking and service terms.</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            If GoRaahi introduces online payments or other payment-processing services in the future, this Privacy Policy may be updated to explain the collection and processing of payment-related information.
                        </Text>

                        {/* 4. Sharing of Information */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>4. Sharing of Information</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            We may share information when reasonably necessary to operate GoRaahi and provide the Service.
                        </Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>4.1 With Drivers and Passengers</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Certain information may be shared between passengers and drivers when necessary to facilitate a booking.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            For example, information relevant to completing a booking may be made available to the driver, including the passenger’s name, pickup information, destination, booking details, and contact information where necessary.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Similarly, relevant driver and vehicle information may be displayed to passengers.
                        </Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>4.2 Service Providers</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            We may use third-party service providers for services such as:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Cloud hosting</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Authentication and OTP services</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Database infrastructure</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Maps and location services</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Analytics</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Communications</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Security</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Technical support</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            These providers may process information on our behalf as necessary to provide their services.
                        </Text>

                        <Text style={[styles.subHeading, { color: colors.textColor }]}>4.3 Legal and Safety Requirements</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            We may disclose information where reasonably necessary to:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Comply with applicable law</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Respond to lawful requests from authorities</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Protect the rights, safety, or property of GoRaahi, users, drivers, or others</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Investigate fraud, abuse, security incidents, or illegal activity</Text>

                        {/* 5. Third-Party Services */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>5. Third-Party Services</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi may use third-party technologies and services to provide functionality such as authentication, maps, hosting, analytics, communications, and other technical services.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            These third parties may process information according to their own privacy policies and applicable agreements.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi does not control the privacy practices of third-party services.
                        </Text>

                        {/* 6. Cookies and Similar Technologies */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>6. Cookies and Similar Technologies</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi may use cookies, local storage, session technologies, and similar technologies to:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Keep users signed in</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Maintain sessions</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Remember preferences</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Improve website functionality</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Understand how users interact with the Service</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Detect security issues</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            You may be able to control cookies through your browser settings. Disabling certain cookies or storage technologies may affect some functionality.
                        </Text>

                        {/* 7. Data Security */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>7. Data Security</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            We take reasonable technical and organizational measures to protect personal information from unauthorized access, alteration, disclosure, loss, or misuse.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            However, no internet-based service can guarantee absolute security.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            You should also protect your account information and avoid sharing OTPs, passwords, or authentication information with other people.
                        </Text>

                        {/* 8. Data Retention */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>8. Data Retention</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            We retain personal information for as long as reasonably necessary to:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Provide and maintain the Service</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Maintain business and transaction records</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Resolve disputes</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Prevent fraud and abuse</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Meet legal or regulatory obligations</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Enforce our agreements</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            When information is no longer reasonably required, we may delete, anonymize, or securely dispose of it, subject to applicable legal requirements.
                        </Text>

                        {/* 9. Your Privacy Choices and Rights */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>9. Your Privacy Choices and Rights</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Depending on applicable law, you may have rights regarding your personal information, including the ability to:
                        </Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Request access to certain personal information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Request correction of inaccurate information</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Request deletion of your account or personal information, subject to legal and operational requirements</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Withdraw certain permissions, such as location access</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Ask questions about how your information is processed</Text>
                        <Text style={[styles.bulletPoint, { color: colors.textColor }]}>• Raise a privacy-related complaint</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, marginTop: 4 }]}>
                            To make a privacy request, contact us using the information provided below.
                        </Text>

                        {/* 10. Account and Data Deletion */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>10. Account and Data Deletion</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            If you no longer want to use GoRaahi, you may request deletion of your account and associated personal information by contacting us.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Some information may need to be retained where required by law, necessary to resolve disputes, prevent fraud, maintain security, or comply with legitimate business obligations.
                        </Text>

                        {/* 11. Children’s Privacy */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>11. Children’s Privacy</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            GoRaahi is not intended to knowingly collect personal information from children in circumstances where such collection is prohibited by applicable law.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            If you believe that a child has provided personal information to GoRaahi without appropriate authorization, please contact us so that we can review the matter and take appropriate action.
                        </Text>

                        {/* 12. Changes to This Privacy Policy */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>12. Changes to This Privacy Policy</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            We may update this Privacy Policy from time to time to reflect changes to our services, technology, legal requirements, or business practices.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            When we make changes, we may update the “Last Updated” date at the top of this policy.
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            Your continued use of GoRaahi after an updated Privacy Policy becomes effective means that you acknowledge the updated policy.
                        </Text>

                        {/* 13. Contact Us */}
                        <Text style={[styles.sectionHeading, { color: colors.primary }]}>13. Contact Us</Text>
                        <Text style={[styles.paragraph, { color: colors.textColor }]}>
                            If you have questions, concerns, requests, or complaints regarding this Privacy Policy or the handling of your personal information, please contact:
                        </Text>
                        <Text style={[styles.paragraph, { color: colors.textColor, fontWeight: 'bold' }]}>
                            GoRaahi Mountain Mobility LLP
                        </Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://goraahi.in')}>
                            <Text style={[styles.paragraph, { color: colors.primary, textDecorationLine: 'underline' }]}>
                                Website: https://goraahi.in
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.noticeBox}>
                            <Text style={styles.noticeTitle}>Important Note</Text>
                            <Text style={styles.noticeText}>
                                This Privacy Policy describes GoRaahi’s current practices. If GoRaahi later introduces online payments, advertising, WhatsApp communications, additional analytics, background location tracking, or other data-processing features, this policy should be reviewed and updated accordingly.
                            </Text>
                        </View>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 6,
        marginRight: 10,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        padding: 6,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        borderRadius: 24,
        borderWidth: 1,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '700',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
    },
    docHeader: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(150,150,150,0.2)',
        paddingBottom: 12,
        marginBottom: 16,
    },
    docTitle: {
        fontSize: 22,
        fontWeight: '800',
    },
    docMeta: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    sectionHeading: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 18,
        marginBottom: 8,
    },
    subHeading: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 6,
    },
    paragraph: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 10,
    },
    bulletPoint: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 6,
        paddingLeft: 4,
    },
    noticeBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
        padding: 14,
        borderRadius: 6,
        marginVertical: 16,
    },
    noticeTitle: {
        color: '#F59E0B',
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 4,
    },
    noticeText: {
        color: '#D97706',
        fontSize: 12,
        lineHeight: 17,
    },
});

export default LegalScreen;
