import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { authApi } from "../../services/api/authApi";
import { AxiosError } from "axios";

interface FormData {
  email: string;
  username: string;
  password: string;
  country: string;
}

export default function Register() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  
  const [formData, setFormData] = useState<FormData>({
    email: "",
    username: "",
    password: "",
    country: "USA",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Invalid email format";
    }
    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be 3+ characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = "Username invalid";
    }
    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 8) {
      errors.password = "Password must be 8+ characters";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setError("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      const response = await authApi.register({
        ...formData,
        email: formData.email.toLowerCase().trim(),
        username: formData.username.trim(),
        age_confirmed: true,
      });
      const data = response.data;
      login(data.user, data.access_token, data.refresh_token);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; details?: Array<{ field: string; message: string }> }>;
      if (axiosError.response?.data?.details) {
        const serverErrors: Record<string, string> = {};
        axiosError.response.data.details.forEach((detail) => {
          serverErrors[detail.field] = detail.message;
        });
        setFieldErrors(serverErrors);
      } else if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else {
        setError("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: "" });
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join and play!</Text>
        {error ? <View style={styles.errorContainer}><Text style={styles.errorText}>{error}</Text></View> : null}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={[styles.input, fieldErrors.email && styles.inputError]} placeholder="your@email.com" placeholderTextColor="#999" value={formData.email} onChangeText={(value) => updateField("email", value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={!loading} />
            {fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput style={[styles.input, fieldErrors.username && styles.inputError]} placeholder="Choose username" placeholderTextColor="#999" value={formData.username} onChangeText={(value) => updateField("username", value)} autoCapitalize="none" autoCorrect={false} editable={!loading} />
            {fieldErrors.username && <Text style={styles.fieldError}>{fieldErrors.username}</Text>}
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput style={[styles.input, fieldErrors.password && styles.inputError]} placeholder="At least 8 chars" placeholderTextColor="#999" value={formData.password} onChangeText={(value) => updateField("password", value)} secureTextEntry editable={!loading} />
            {fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}
          </View>
          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.bonusContainer}>
          <Text style={styles.bonusText}>Get Gold FREE on signup!</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.linkContainer} disabled={loading}>
          <Text style={styles.linkText}>Already have account? <Text style={styles.linkTextBold}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backButton: { marginBottom: 20, alignSelf: "flex-start" },
  backButtonText: { color: "#667eea", fontSize: 16, fontWeight: "500" },
  title: { fontSize: 32, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 32 },
  errorContainer: { backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA", padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: "#DC2626", textAlign: "center", fontSize: 14 },
  form: { gap: 16 },
  inputContainer: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: "#333" },
  input: { backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#ddd", fontSize: 16, color: "#333" },
  inputError: { borderColor: "#DC2626" },
  fieldError: { color: "#DC2626", fontSize: 12, marginTop: 4 },
  button: { backgroundColor: "#667eea", paddingVertical: 18, borderRadius: 12, alignItems: "center", marginTop: 8, shadowColor: "#667eea", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  buttonDisabled: { backgroundColor: "#999", shadowOpacity: 0 },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  bonusContainer: { backgroundColor: "#FEF3C7", padding: 12, borderRadius: 8, marginTop: 24, alignItems: "center" },
  bonusText: { color: "#92400E", fontWeight: "600", fontSize: 14 },
  linkContainer: { marginTop: 24, alignItems: "center", paddingBottom: 24 },
  linkText: { color: "#666", fontSize: 16 },
  linkTextBold: { color: "#667eea", fontWeight: "bold" },
});
