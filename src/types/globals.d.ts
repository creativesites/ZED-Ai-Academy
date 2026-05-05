export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      onboardingComplete?: boolean
    }
    profile_image?: string
    sourse_platform?: string
  }
}
