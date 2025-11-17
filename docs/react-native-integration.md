# Guia de Integração (React Native)

Este documento auxilia outra pessoa/agente a implementar o consumo da API no aplicativo React Native. Considere este guia como um checklist prático.

## Configuração Inicial

1. **Base URL:** `http://<host>:4000` (ajuste a porta/host conforme ambiente).
2. **Bibliotecas sugeridas:**  
   - `axios` para requisições HTTP.  
   - `@react-native-async-storage/async-storage` para persistir JWT.  
   - `react-query` ou `zustand`/`redux` para cache/estado (opcional).
3. **Headers padrão:**  
   ```ts
   const api = axios.create({
     baseURL: process.env.API_URL ?? 'http://localhost:4000',
     timeout: 10000
   });

   api.interceptors.request.use(async (config) => {
     const token = await AsyncStorage.getItem('token');
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });
   ```

## Endpoints e Implementação

### 1. Autenticação

#### POST `/auth/register`
- **Payload:** `{ email, password, name }`
- **Resposta:** `{ token, client }`
- **Fluxo no RN:** após sucesso, salvar `token` e perfil; navegar para área autenticada.

#### POST `/auth/login`
- **Payload:** `{ email, password }`
- **Resposta:** `{ token, client }`
- **Fluxo:** semelhante ao register; tratar status 401 mostrando mensagem ao usuário.

### 2. Perfil

#### GET `/profile/me`
- **Requer:** header `Authorization`.
- **Resposta:** `{ id, email, name, role, age, availability, profilePhoto }`
- **UI:** exibir campos editáveis (nome, cargo, idade, disponibilidade, foto).

#### PUT `/profile/me`
- **Payload exemplo:**
  ```json
  {
    "name": "Maria Silva",
    "role": "Product Manager",
    "age": 32,
    "availability": {
      "monday": ["09:00-11:00", "13:00-17:00"],
      "tuesday": [],
      "wednesday": ["10:00-18:00"]
    },
    "profilePhoto": "data:image/png;base64,..."
  }
  ```
- **Resposta:** retorna o perfil atualizado.
- **Fluxo:** usar formulário; normalizar horários antes de enviar.

### 3. Agendamentos

#### POST `/bookings`
- **Payload:** `{ room, meetingDate (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm), description }`
- **Resposta:** objeto com `id`, `room`, `meetingDate`, `startTimestamp`, `endTimestamp`, `status`.
- **Validações:** tratar 409 (conflito) e 400 (intervalo inválido).

#### GET `/bookings`
- **Resposta:** lista de agendamentos do usuário ordenada por `start_time`.
- **UI:** pode alimentar uma agenda ou lista com filtros por data/status.

#### PATCH `/bookings/:bookingId`
- **Payload parcial:** qualquer combinação de `meetingDate`, `startTime`, `endTime`, `room`, `description`.
- **Resposta:** objeto completo atualizado.
- **Uso:** tela de edição; antes de enviar, certificar que `bookingId` é UUID válido.

#### PATCH `/bookings/:bookingId/cancel`
- **Resposta:** `{ message: 'Agendamento cancelado.' }`
- **Fluxo:** confirmar com usuário; atualizar lista local.

### 4. Chat

#### POST `/chat/support`
- **Payload:** `{ message }`
- **Resposta:** `{ id, channel: 'SUPPORT', message, aiResponse (null), createdAt }`
- **Fluxo:** use `createdAt` para ordenar; persistir envio offline se necessário.

#### GET `/chat/support`
- **Resposta:** array das mensagens enviadas ao suporte.
- **Uso:** preencher histórico (exibir `aiResponse` quando suporte responder manualmente via backoffice).

#### POST `/chat/ai`
- **Payload:** `{ message }`
- **Resposta:** `{ id, message, aiResponse, createdAt }`
- **Observações:**  
  - Se `OPENAI_API_KEY` estiver configurado no backend, a resposta será real; caso contrário será heurística.  
  - Tratar erros de rede/timeout para notificar usuário.

### 5. Automação

#### POST `/automation/release-expired`
- **Função:** dispara a procedure PL/SQL e retorna `{ message, released }`.
- **Uso:** normalmente restrito a administradores; proteger com UI apropriada.

## Boas práticas para o app

1. **Refresh dos dados:** após criar/cancelar agendamentos, refaça `GET /bookings`.
2. **Tratamento de erros:** backend retorna mensagens em português (`message`), exiba diretamente ou traduza conforme design.
3. **Disponibilidade:** mantenha um componente para edição dos slots com validação antes de enviar (`PUT /profile/me`).
4. **Envio de fotos:** `profilePhoto` aceita base64 ou URL. Considere subir para um storage e salvar URL para reduzir payload.
5. **Segurança:** nunca logue o token JWT; use `SecureStore`/`Keychain` em produção.

## Exemplo resumido (React Query + Axios)

```ts
const useBookings = () => {
  return useQuery(['bookings'], async () => {
    const { data } = await api.get('/bookings');
    return data;
  });
};

const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/bookings', payload).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries(['bookings'])
  });
};
```

Este arquivo pode ser entregue a outro agente ou dev mobile para garantir consumo consistente dos endpoints.
