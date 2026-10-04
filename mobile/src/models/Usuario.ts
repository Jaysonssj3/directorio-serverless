export type Role = 'ADMIN' | 'USER';
export interface Usuario { id: string; nombre: string; email: string; role: Role; createdAt: string }
export interface Page { content: Usuario[]; page: number; size: number }
export interface UsuarioInput { nombre: string; email: string; password: string; role: Role }
export interface Session { accessToken: string; expiresAt: number; baseUrl: string }
export interface LoginResponse { accessToken: string; tokenType: string; expiresIn: number }
export interface Photo { uri: string; name: string; type: 'image/jpeg' }
