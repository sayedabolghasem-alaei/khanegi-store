// Zod schemas for admin shipping-method CRUD (shared by the collection and
// [id] route handlers). Fields mirror the ShippingMethod model exactly:
// name, description?, costToman, freeThresholdToman?, estimatedDays?,
// isActive, sortOrder.

import { z } from "zod";

export const shippingMethodInputSchema = z.object({
  name: z.string().trim().min(2, "نام روش ارسال الزامی است.").max(80, "حداکثر ۸۰ کاراکتر مجاز است."),
  description: z.string().trim().max(300, "حداکثر ۳۰۰ کاراکتر مجاز است.").optional(),
  costToman: z.coerce
    .number({ message: "هزینه ارسال باید عدد باشد." })
    .int("هزینه ارسال باید عدد صحیح باشد.")
    .min(0, "هزینه ارسال نمی‌تواند منفی باشد."),
  freeThresholdToman: z.coerce
    .number({ message: "آستانه ارسال رایگان باید عدد باشد." })
    .int("آستانه باید عدد صحیح باشد.")
    .min(0, "آستانه نمی‌تواند منفی باشد.")
    .nullable()
    .optional(),
  estimatedDays: z.string().trim().max(60, "حداکثر ۶۰ کاراکتر مجاز است.").optional(),
  isActive: z.boolean({ message: "مقدار باید بولی باشد." }).optional(),
  sortOrder: z.coerce
    .number({ message: "ترتیب نمایش باید عدد باشد." })
    .int("ترتیب نمایش باید عدد صحیح باشد.")
    .min(0, "ترتیب نمایش نمی‌تواند منفی باشد.")
    .optional(),
});

export type ShippingMethodInput = z.input<typeof shippingMethodInputSchema>;
