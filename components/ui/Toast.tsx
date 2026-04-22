import { Toaster, toast as hotToast } from "react-hot-toast";

export const toast = {
  success: (msg: string) => hotToast.success(msg),
  error: (msg: string) => hotToast.error(msg),
};

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: "Work Sans, sans-serif",
          fontSize: "14px",
        },
      }}
    />
  );
}
