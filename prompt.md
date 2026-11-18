# MASTER DEVELOPMENT PROMPT: VETLINK PET OWNER MOBILE APPLICATION

## 1. PROJECT OVERVIEW

Develop a complete, functional, mobile-based application for the pet-owner side of **VetLink**, a multi-clinic veterinary clinic locator, appointment booking, and pet health record management system.

**Project Name:** VetLink

**Application:** Pet Owner Mobile Application

**Development Phase:** Phase 1 – Mobile Application Development

**Primary Testing Platform:** Expo Go

**Design Reference (Figma):**
https://www.figma.com/design/qImepIuwKct2n1gj5nzyxc/VetLink-App?node-id=13-3730

Your task is to translate the existing Pet Owner Mobile UI/UX design in Figma into a fully functional React Native application.

Do not create a new design from scratch. Use the existing Figma screens as the primary reference for the application's appearance, layouts, colors, typography, components, spacing, icons, and navigation.

The result should look as close as reasonably possible to the existing Figma design.

IMPORTANT: This development phase is exclusively for the PET OWNER MOBILE APPLICATION. Do not develop the clinic administrator, veterinarian, receptionist, clinic staff, or system administrator web interfaces yet.

---

## 2. TECHNOLOGY STACK AND DEVELOPMENT REQUIREMENTS

Use the following technologies:

### Frontend
- React Native
- Expo
- TypeScript
- Expo Router or React Navigation (choose one consistent navigation solution)
- Functional React components
- React Hooks

### UI and Styling
- React Native StyleSheet or a consistent styling solution compatible with Expo.
- Reusable components.
- Consistent design tokens for colors, typography, spacing, border radii, and shadows.
- Expo-compatible icon libraries, preferably @expo/vector-icons.

### Testing
- Expo Go
- Android physical devices
- Expo development server

### Backend and Database
DO NOT IMPLEMENT A DATABASE YET.

Do not configure or connect:
- MySQL
- PostgreSQL
- MongoDB
- Firebase
- Supabase
- SQLite
- Any cloud database
- Any backend server
- Any external authentication service

All information should come from locally defined mock data and temporary application state.

Create a clean service architecture that will make it easy to connect a real backend and database in a future development phase.

Do not hardcode mock data directly inside individual screen components. Organize mock data in dedicated files and access it through reusable service functions.

---

## 3. DESIGN REQUIREMENTS

Follow the existing VetLink Figma design.

### Branding
- Application name: VetLink.
- Use the existing VetLink logo or recreate it faithfully from the design reference.
- Maintain the existing brand identity.
- Use the same red/maroon color palette shown in the Figma design.
- Use clean, modern, friendly, and professional visual styling.

### Overall Visual Style
The application should have:
- Modern mobile application layouts.
- Clean and organized interfaces.
- Rounded cards and buttons.
- Consistent spacing.
- Clear visual hierarchy.
- Readable typography.
- Appropriate veterinary and pet-related icons.
- Consistent navigation.
- Attractive empty states.
- Appropriate loading and success states.

### Mobile Screen Dimensions
Use the existing Figma mobile frame dimensions as your primary design reference:

390 × 844 pixels (iPhone 14 reference).

However, the actual React Native layouts must be responsive and adapt to different Android and iOS screen sizes.

Do not use fixed positioning for the entire screen. Use Flexbox, ScrollView, SafeAreaView, and responsive dimensions appropriately.

### Important Design Rules
1. Do not arbitrarily change the existing Figma layout.
2. Do not introduce a different color palette.
3. Do not redesign existing screens unnecessarily.
4. Maintain visual consistency across all screens.
5. Reuse components instead of creating inconsistent versions of the same element.
6. Make sure text does not overflow.
7. Make sure buttons and interactive elements are properly sized.
8. Support scrolling for screens with lengthy content.
9. Use appropriate keyboard avoidance behavior on forms.
10. Ensure the bottom navigation does not overlap screen content.

---

# 4. APPLICATION STRUCTURE AND ALL REQUIRED SCREENS

Implement ALL the following Pet Owner Mobile Application screens.

Do not skip screens simply because some are similar.

## MODULE 1: SPLASH SCREEN AND ONBOARDING

Implement:

1. Splash Screen
2. Onboarding Welcome
3. Onboarding – Find Veterinary Clinics
4. Onboarding – Book Appointments
5. Onboarding – Manage Pet Health Records

Requirements:
- Display the VetLink logo.
- Add an appropriate splash screen.
- Introduce the application's main benefits.
- Include Next, Skip, and Get Started actions.
- Include onboarding pagination indicators.
- Allow users to proceed to authentication.
- Prevent onboarding from unnecessarily appearing every time the application opens during the same session.

## MODULE 2: AUTHENTICATION AND ACCOUNT MANAGEMENT

Implement:

6. Login
7. Create Account / Sign Up
8. Email Verification
9. Forgot Password
10. Reset Password

These screens must be functional even without a backend.

### Login
Include:
- Email address.
- Password.
- Show/hide password.
- Remember Me.
- Forgot Password link.
- Login button.
- Navigate to Create Account.
- Input validation.
- Appropriate error messages.

Implement mock authentication.

Provide a demonstration account:

Email: owner@vetlink.com
Password: VetLink123!

The demonstration credentials should allow the user to access the application without registering.

### Sign Up
Include:
- First name.
- Last name.
- Email address.
- Mobile number.
- Password.
- Confirm password.
- Terms and Privacy Policy agreement.
- Create Account button.
- Link to Login.

Validation:
- Required fields.
- Valid email format.
- Valid mobile number.
- Minimum password requirements.
- Password confirmation must match.
- Terms and conditions must be accepted.

After successful registration, navigate to the simulated email verification screen.

### Email Verification
- Display a simulated six-digit verification code.
- Allow code entry.
- Include a resend code option.
- Include verification success and failure states.
- Use a clearly documented demo verification code.

Do not send actual emails.

### Forgot Password
- Allow the user to enter their email.
- Display a simulated password reset confirmation.
- Provide a way to return to login.

### Reset Password
- New password.
- Confirm new password.
- Password visibility toggle.
- Password requirements.
- Reset Password action.
- Success confirmation.

All authentication logic must be isolated in a mock authentication service so it can later be replaced by real API authentication.

## MODULE 3: HOME AND NAVIGATION

Implement:

11. Home Dashboard
12. Notifications
13. Global Search
14. Notification Details

### Home Dashboard
Include:
- Personalized greeting.
- Pet-owner profile information.
- Search veterinary clinics.
- Nearby or featured veterinary clinics.
- Registered pets.
- Upcoming appointments.
- Upcoming vaccinations.
- Quick actions.
- AI Assistant shortcut.
- Notifications shortcut.

Use realistic sample information.

### Bottom Navigation

Create a consistent bottom navigation bar with:

- Home
- Clinics
- Appointments
- My Pets
- Profile

All navigation items must work.

The selected navigation item must have an appropriate active state.

### Notifications
Include:
- Appointment reminders.
- Appointment status updates.
- Vaccination reminders.
- General system notifications.
- Read/unread indicators.
- Notification details.

Allow users to mark notifications as read.

### Global Search
Allow searching through available mock content such as:
- Veterinary clinics.
- Clinic services.
- Registered pets.
- Appointments.

Provide appropriate search results and empty states.

## MODULE 4: VETERINARY CLINIC LOCATOR

Implement:

15. Clinic Discovery
16. Clinic Search Results
17. Map View
18. Filter and Sort Clinics
19. Clinic Details
20. Clinic Services
21. Service Details
22. Clinic Contact Information

This module must support a multi-clinic platform.

Pet owners should be able to explore different independent veterinary clinics.

### Clinic Discovery
Display:
- Search bar.
- Featured clinics.
- Nearby clinics.
- Clinic categories or services.
- Clinic cards.
- Clinic ratings using sample data.
- Clinic location.
- Clinic operating hours.

### Clinic Search Results
Display:
- Multiple veterinary clinic results.
- Clinic name.
- Clinic image or logo.
- Address.
- Distance using sample values.
- Operating hours.
- Available services.
- Ratings using sample values.

### Map View
Use an Expo Go-compatible map implementation.

Display mock clinic locations when possible.

Allow users to:
- View clinic markers.
- Select a clinic marker.
- View basic clinic information.
- Navigate to clinic details.

Do not require a Google Maps API key for the initial mock implementation. If a map provider requires configuration, provide a graceful fallback to a clinic list/map placeholder and document the setup.

### Filter and Sort
Include filters for:
- Clinic services.
- Distance.
- Clinic ratings.
- Availability.
- Operating status.

Provide sorting options.

### Clinic Details
Include:
- Clinic name and logo.
- Clinic images.
- Description.
- Address.
- Contact details.
- Operating hours.
- Ratings.
- Available services.
- Book Appointment button.

### Clinic Services
Display all services offered by the selected clinic.

### Service Details
Include:
- Service name.
- Description.
- Sample pricing.
- Duration, when applicable.
- Book Appointment action.

### Clinic Contact Information
Include:
- Address.
- Phone number.
- Email.
- Operating hours.
- Contact actions.

All clinics must use centralized mock data. Selecting a clinic must preserve the selected clinic information throughout the booking process.

## MODULE 5: APPOINTMENT BOOKING

Implement:

23. Select Veterinary Clinic
24. Select Pet
25. Select Service
26. Choose Appointment Date
27. Choose Available Time
28. Appointment Information
29. Review Booking Details
30. Booking Confirmation
31. Booking Successful

### Booking Workflow

Implement the following sequence:

1. Select a veterinary clinic.
2. Select one of the registered pets.
3. Select an available clinic service.
4. Choose an appointment date.
5. Choose an available time.
6. Enter additional appointment information.
7. Review all booking information.
8. Confirm the appointment.
9. Display a booking success screen.

### Important Requirements
- Maintain the selected clinic throughout booking.
- Maintain the selected pet.
- Maintain the selected service.
- Maintain the selected date and time.
- Allow users to go back and edit information.
- Prevent users from proceeding without completing required fields.
- Display a booking summary.
- Generate a mock appointment reference number.
- Add successful bookings to the local application state.
- Display the new booking under My Appointments.

Available time slots should be generated from mock availability data.

Do not connect to a real clinic scheduling system yet.

## MODULE 6: PET PROFILE MANAGEMENT

Implement:

32. My Pets
33. Pet Profile Details
34. Add New Pet
35. Edit Pet Information
36. Pet Photo Upload

### My Pets
Display all registered pets.

Each pet card should include:
- Pet photo.
- Pet name.
- Species.
- Breed.
- Age.
- Gender.

### Pet Profile Details
Include:
- Pet photo.
- Name.
- Species.
- Breed.
- Date of birth.
- Gender.
- Weight.
- Color.
- Identification details, if applicable.
- Medical information summary.
- Vaccination summary.
- Appointment history.

### Add New Pet
Create a form with:
- Pet name.
- Species.
- Breed.
- Date of birth.
- Gender.
- Weight.
- Color.
- Additional notes.
- Pet photo.

Support common species such as dogs and cats.

### Edit Pet Information
Allow users to update the information of their registered pets.

### Pet Photo Upload
Use an Expo-compatible image picker.

Allow users to:
- Select a photo from their gallery.
- Preview the selected image.
- Replace the image.
- Remove the image.

Request device permissions appropriately.

## MODULE 7: PET HEALTH RECORDS

Implement:

37. Health Records Overview
38. Medical History
39. Medical Record Details
40. Vaccination Records
41. Vaccination Details
42. Upcoming Vaccinations
43. Appointment History
44. Medical Record Attachments

### Health Records Overview
Display:
- Selected pet.
- Medical history summary.
- Vaccination status.
- Upcoming vaccinations.
- Recent veterinary visits.

### Medical History
Display a chronological list of mock medical records.

Include:
- Consultation date.
- Veterinary clinic.
- Veterinarian.
- Diagnosis.
- Treatment summary.

### Medical Record Details
Display complete sample record information.

### Vaccination Records
Display:
- Vaccine name.
- Date administered.
- Next vaccination date.
- Veterinary clinic.
- Vaccination status.

### Vaccination Details
Show detailed vaccination information.

### Upcoming Vaccinations
Display upcoming vaccination schedules with appropriate reminder indicators.

### Appointment History
Display completed and past appointments.

### Medical Record Attachments
Allow users to preview sample documents and images.

Use locally stored mock attachment references. Do not upload documents to a server.

IMPORTANT: Pet owners may view their medical records, but must not be able to directly modify veterinarian-issued diagnoses, treatments, or official vaccination records.

## MODULE 8: APPOINTMENT MANAGEMENT

Implement:

45. My Appointments
46. Upcoming Appointments
47. Appointment Details
48. Reschedule Appointment
49. Cancel Appointment
50. Appointment Status

### My Appointments
Display:
- Upcoming appointments.
- Pending appointments.
- Completed appointments.
- Cancelled appointments.

Include appropriate status labels.

### Appointment Details
Display:
- Appointment reference number.
- Clinic information.
- Pet information.
- Service.
- Date and time.
- Appointment notes.
- Appointment status.

### Reschedule Appointment
Allow users to select another available date and time using mock availability.

### Cancel Appointment
Include:
- Cancellation confirmation.
- Optional cancellation reason.
- Cancel and Keep Appointment actions.

### Appointment Status
Show status progression such as:
- Pending.
- Confirmed.
- Completed.
- Cancelled.

Ensure that changes in mock application state are reflected throughout the app.

## MODULE 9: AI-ASSISTED INQUIRY

Implement:

51. AI Assistant Introduction
52. AI Chat Interface
53. Suggested Questions
54. Preliminary Information
55. Inquiry Submission Confirmation

### AI Assistant Introduction
Introduce the AI-assisted inquiry feature.

Explain that it can help users understand VetLink services and collect preliminary information for clinic personnel.

### AI Chat Interface
Create a modern chat interface with:
- Chat bubbles.
- User messages.
- Assistant messages.
- Message input.
- Send button.
- Suggested questions.
- Chat loading indicator.

For this phase, implement a rule-based or predefined mock-response system.

Do not integrate an external AI API.

### Suggested Questions
Include example questions such as:
- How do I book an appointment?
- How can I find a veterinary clinic?
- How do I add a pet?
- How can I view my pet's vaccination records?
- How do I reschedule an appointment?

### Preliminary Information
Allow users to submit:
- Name.
- Contact information.
- Pet information.
- Selected clinic, when applicable.
- Inquiry category.
- Description of concern.

### Inquiry Submission Confirmation
Display a successful mock submission confirmation.

Save the inquiry temporarily in local application state.

Include a clear disclaimer that the AI feature does not provide veterinary diagnosis or replace professional veterinary advice.

Do not claim that inquiries have actually been forwarded to a clinic because no backend exists yet.

## MODULE 10: PROFILE AND SETTINGS

Implement:

56. My Profile
57. Edit Personal Information
58. Account Settings
59. Change Password
60. Privacy and Security
61. Help and Support
62. About VetLink
63. Logout Confirmation

### My Profile
Display:
- Profile photo.
- Full name.
- Email.
- Mobile number.
- Account information.

### Edit Personal Information
Allow editing:
- First name.
- Last name.
- Mobile number.
- Profile photo.

### Account Settings
Include appropriate account preferences.

### Change Password
Implement:
- Current password.
- New password.
- Confirm password.
- Validation.
- Success confirmation.

Simulate the password update locally.

### Privacy and Security
Include:
- Privacy information.
- Account security information.
- Available privacy preferences.
- Account information.

### Help and Support
Include:
- Frequently asked questions.
- Contact information.
- Basic support options.

### About VetLink
Display:
- Application name.
- Logo.
- Description.
- Version number.
- Basic application information.

### Logout Confirmation
Show a confirmation dialog before logging out.

After logout, return to the login screen.

---

# 5. FUNCTIONALITY REQUIREMENTS

This application must not be just a collection of static screens.

Implement working interactions throughout the application.

Examples:

- Login must validate credentials.
- Signup must validate all required information.
- Password visibility toggles must work.
- Forms must accept and validate input.
- Navigation must work.
- Bottom navigation must work.
- Search must return mock results.
- Filters must change displayed clinic results.
- Selecting a clinic must open its details.
- Selecting a service must preserve the selected service.
- Appointment booking must follow the entire booking sequence.
- Successful bookings must appear in My Appointments.
- Pet registration must add a pet to My Pets.
- Editing a pet must update the displayed information.
- Pet selection must update relevant health record screens.
- Appointment rescheduling must update the mock appointment.
- Appointment cancellation must update its status.
- Notifications must support read/unread states.
- AI inquiry messages must receive predefined responses.
- Inquiry submissions must display confirmation.
- Profile changes must be reflected throughout the app.
- Logout must return to authentication.

All changes should be reflected consistently across relevant screens during the application session.

---

# 6. MOCK DATA ARCHITECTURE

Since there is no database yet, create organized mock data.

Suggested mock data files:

- mockUsers.ts
- mockClinics.ts
- mockPets.ts
- mockServices.ts
- mockAppointments.ts
- mockMedicalRecords.ts
- mockVaccinations.ts
- mockNotifications.ts
- mockInquiries.ts

Create service modules that operate on these mock data sources.

For example:

- authService
- clinicService
- petService
- appointmentService
- medicalRecordService
- vaccinationService
- notificationService
- inquiryService

Use promises or asynchronous service functions where appropriate to simulate future API requests.

Do not put all business logic inside screen components.

Use a centralized application state solution appropriate for this application's size.

The architecture must make future database integration straightforward.

### Authentication Behavior

Use a mock authentication service.

Support:
- Demo login.
- User signup.
- Simulated email verification.
- Simulated password reset.
- Password change.
- Logout.
- Basic session state.

Do not claim that accounts or passwords are securely stored in a production authentication system.

Clearly document the limitations of the mock authentication.

---

# 7. RECOMMENDED PROJECT FOLDER STRUCTURE

Organize the project professionally.

Suggested structure:

app/
  _layout.tsx
  index.tsx

  (onboarding)/
    splash.tsx
    welcome.tsx
    find-clinics.tsx
    appointments.tsx
    health-records.tsx

  (auth)/
    login.tsx
    signup.tsx
    email-verification.tsx
    forgot-password.tsx
    reset-password.tsx

  (tabs)/
    _layout.tsx
    home.tsx
    clinics.tsx
    appointments.tsx
    pets.tsx
    profile.tsx

  clinics/
    search-results.tsx
    map.tsx
    filters.tsx
    details.tsx
    services.tsx
    service-details.tsx
    contact.tsx

  booking/
    select-clinic.tsx
    select-pet.tsx
    select-service.tsx
    select-date.tsx
    select-time.tsx
    information.tsx
    review.tsx
    confirmation.tsx
    success.tsx

  pets/
    details.tsx
    add.tsx
    edit.tsx
    photo-upload.tsx

  health-records/
    index.tsx
    medical-history.tsx
    medical-details.tsx
    vaccinations.tsx
    vaccination-details.tsx
    upcoming-vaccinations.tsx
    appointment-history.tsx
    attachments.tsx

  appointments/
    upcoming.tsx
    details.tsx
    reschedule.tsx
    cancel.tsx
    status.tsx

  notifications/
    index.tsx
    details.tsx
    search.tsx

  assistant/
    introduction.tsx
    chat.tsx
    suggested-questions.tsx
    preliminary-information.tsx
    submission-confirmation.tsx

  settings/
    edit-profile.tsx
    account.tsx
    change-password.tsx
    privacy.tsx
    support.tsx
    about.tsx
    logout.tsx

components/
  common/
  buttons/
  cards/
  forms/
  navigation/
  clinic/
  pets/
  appointments/
  notifications/

constants/
  colors.ts
  typography.ts
  spacing.ts

data/
  mockUsers.ts
  mockClinics.ts
  mockPets.ts
  mockServices.ts
  mockAppointments.ts
  mockMedicalRecords.ts
  mockVaccinations.ts
  mockNotifications.ts
  mockInquiries.ts

services/
  authService.ts
  clinicService.ts
  petService.ts
  appointmentService.ts
  medicalRecordService.ts
  vaccinationService.ts
  notificationService.ts
  inquiryService.ts

context/
  AuthContext.tsx
  AppContext.tsx

hooks/
utils/
assets/

This is a suggested organization, not a requirement to create empty files for every item. Adjust the structure when necessary, but keep the code modular and maintainable.

---

# 8. EXPO GO COMPATIBILITY REQUIREMENTS

The application must run using Expo Go.

Important:
- Use Expo-compatible packages.
- Avoid custom native modules requiring a custom development build.
- Avoid unsupported native dependencies.
- Use Expo-compatible image picker functionality.
- Use Expo-compatible icons.
- Use compatible navigation libraries.
- Follow Expo SDK package compatibility recommendations.
- Configure permissions correctly.
- Avoid hardcoded device dimensions.
- Test on an actual Android device using Expo Go.

Provide all required installation commands.

Use compatible package versions rather than blindly installing the newest versions.

The application must be runnable using:

npx expo start

The user should be able to scan the QR code using Expo Go and test the application.

---

# 9. USER EXPERIENCE AND ERROR HANDLING

Implement appropriate:
- Loading indicators.
- Empty states.
- Error messages.
- Success messages.
- Confirmation dialogs.
- Form validation.
- Disabled button states.
- Scrollable content.
- Keyboard handling.
- Network-independent mock functionality.

Since the application does not use a backend, the main workflows must work without internet access after the application has loaded, except for optional remote images or external map services.

Use local placeholder images when necessary.

Do not leave buttons that appear functional but do nothing.

If an action cannot be fully implemented without a backend, implement a clearly labeled mock behavior instead.

---

# 10. DEVELOPMENT QUALITY REQUIREMENTS

Write clean, maintainable, and understandable code.

Requirements:
- TypeScript typing.
- Reusable components.
- Reusable form fields.
- Centralized colors and design tokens.
- Consistent navigation.
- No unnecessary code duplication.
- No broken imports.
- No missing screens.
- No placeholder buttons without actions.
- No unnecessary dependencies.
- No database configuration.
- No backend configuration.

Avoid putting the entire application inside one large file.

Keep each screen organized and separate.

---

# 11. IMPLEMENTATION AND TESTING CHECKLIST

Before declaring the application complete, verify the following:

### Application Setup
- [ ] Expo project starts successfully.
- [ ] Application opens in Expo Go.
- [ ] No major runtime errors.
- [ ] Layout adapts to mobile screen sizes.

### Authentication
- [ ] Splash screen.
- [ ] Onboarding.
- [ ] Login.
- [ ] Signup.
- [ ] Email verification.
- [ ] Forgot password.
- [ ] Reset password.
- [ ] Logout.

### Main Application
- [ ] Home dashboard.
- [ ] Bottom navigation.
- [ ] Notifications.
- [ ] Global search.

### Clinic Locator
- [ ] Clinic discovery.
- [ ] Search results.
- [ ] Map view or fallback.
- [ ] Filters.
- [ ] Clinic details.
- [ ] Services.
- [ ] Contact information.

### Appointment Booking
- [ ] Complete booking workflow.
- [ ] Booking confirmation.
- [ ] Booking success.
- [ ] Appointment listing.
- [ ] Rescheduling.
- [ ] Cancellation.

### Pet Management
- [ ] My Pets.
- [ ] Pet details.
- [ ] Add pet.
- [ ] Edit pet.
- [ ] Photo upload.

### Health Records
- [ ] Medical history.
- [ ] Medical details.
- [ ] Vaccination records.
- [ ] Vaccination details.
- [ ] Upcoming vaccinations.
- [ ] Appointment history.
- [ ] Attachments.

### AI-Assisted Inquiry
- [ ] Assistant introduction.
- [ ] Chat interface.
- [ ] Suggested questions.
- [ ] Mock responses.
- [ ] Preliminary information.
- [ ] Submission confirmation.

### Profile and Settings
- [ ] Profile.
- [ ] Edit profile.
- [ ] Account settings.
- [ ] Change password.
- [ ] Privacy and security.
- [ ] Help and support.
- [ ] About VetLink.

---

# 12. FINAL INSTRUCTIONS TO THE DEVELOPMENT AGENT

Your primary objective is to deliver a COMPLETE, WORKING PET OWNER MOBILE APPLICATION based on the existing VetLink Figma design.

Follow these instructions carefully:

1. Inspect the provided Figma design before implementing the interface.
2. Develop the mobile application only.
3. Implement all 63 Pet Owner screens listed in this prompt.
4. Do not implement the clinic personnel web application yet.
5. Do not implement a database or backend.
6. Implement functional mock authentication.
7. Use realistic mock data.
8. Implement working navigation and user interactions.
9. Maintain consistency with the existing VetLink branding and Figma design.
10. Ensure Expo Go compatibility.
11. Organize the project so backend and database integration can be added in a later phase.
12. Do not simply generate static UI screenshots. Build actual React Native screens and working application logic.

### DEVELOPMENT STRATEGY

Do not attempt to generate all screens in one uncontrolled operation.

Work in manageable modules while maintaining a consistent application architecture.

Recommended order:

Phase 1 – Project setup, branding, navigation, reusable components.

Phase 2 – Splash screen, onboarding, authentication, and account management.

Phase 3 – Home dashboard, notifications, and search.

Phase 4 – Veterinary clinic locator and clinic details.

Phase 5 – Complete appointment booking workflow.

Phase 6 – Pet profile management.

Phase 7 – Pet health records and vaccination management.

Phase 8 – Appointment management.

Phase 9 – AI-assisted inquiry.

Phase 10 – Profile and settings.

Phase 11 – Application-wide integration, testing, and bug fixing.

After completing each phase:
- Run the application.
- Check for errors.
- Test the implemented navigation.
- Verify that the screens follow the Figma reference.
- Fix problems before continuing.

Do not discard or rewrite previously completed modules when implementing the next phase.

At the end, provide:
- Complete project folder structure.
- Installation instructions.
- Expo Go testing instructions.
- Demo account credentials.
- Implemented screen checklist.
- Known limitations.
- Instructions for running the application.

**FINAL EXPECTATION: A complete, navigable, interactive VetLink Pet Owner Mobile Application that can be launched and tested using Expo Go, without requiring a database or backend at this stage.**