export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  content: string;
  referenceType?: string;
  referenceId?: string;
}
