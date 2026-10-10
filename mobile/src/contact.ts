import { Linking } from 'react-native'

/** Where people write to the admin: a refused request, removing published work, changing their role. */
export const CONTACT_EMAIL = 'admin@balagh.space'

export const writeToAdmin = () => Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => undefined)
