import { http, HttpResponse } from 'msw';

export const mockUser = {
  id: 'user-uuid-1',
  email: 'owner@business.com',
  first_name: 'Ashwin',
  last_name: 'Aditya',
};

export const mockBusiness = {
  id: 'biz-uuid-1',
  name: 'Zenvlo Wellness',
  slug: 'zenvlo-wellness',
  category: 'Salon & Spa',
  phone: '+919876543210',
  website: 'https://zenvlo.com',
  location: 'Bangalore, India',
  logo_url: null,
};

export const mockCustomers = [
  {
    id: 'cust-1',
    name: 'Rahul Sharma',
    phone: '+919988776655',
    email: 'rahul@example.com',
    notes: 'VIP customer',
    tags: ['VIP', 'Repeat'],
    last_request_sent_at: null,
    request_count: 0,
    created_on: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'cust-2',
    name: 'Priya Patel',
    phone: '+919988776644',
    email: 'priya@example.com',
    notes: null,
    tags: ['New'],
    last_request_sent_at: '2026-01-02T12:00:00.000Z',
    request_count: 1,
    created_on: '2026-01-02T10:00:00.000Z',
  },
];

export const mockTestimonials = [
  {
    id: 'test-1',
    customer_name: 'Rahul Sharma',
    customer_phone: '+919988776655',
    customer_email: 'rahul@example.com',
    rating: 5,
    content: 'Incredible experience! The team at Zenvlo was professional and courteous.',
    photo_url: null,
    video_url: null,
    approval_status: 'PENDING',
    source: 'PUBLIC_FORM',
    created_on: '2026-01-03T14:00:00.000Z',
  },
  {
    id: 'test-2',
    customer_name: 'Priya Patel',
    customer_phone: '+919988776644',
    customer_email: 'priya@example.com',
    rating: 5,
    content: 'Best service in town! Highly recommend their spa packages.',
    photo_url: 'https://example.com/photo.jpg',
    video_url: null,
    approval_status: 'APPROVED',
    source: 'PUBLIC_FORM',
    created_on: '2026-01-02T15:00:00.000Z',
  },
];

export const mockWidgets = [
  {
    id: 'widget-1',
    name: 'Wall of Love',
    type: 'WALL',
    theme: 'DARK',
    primary_color: '#10b981',
    min_rating: 4,
    show_google_reviews: true,
    show_photos: true,
    custom_css: null,
    embed_token: 'zen_1234567890abcdef',
    is_active: true,
    views_count: 42,
    created_on: '2026-01-01T12:00:00.000Z',
  },
];

export const handlers = [
  // --- AUTHENTICATION ---
  http.post('*/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.email === 'conflict@business.com') {
      return HttpResponse.json(
        { message: 'A user with this email address already exists' },
        { status: 409 }
      );
    }
    return HttpResponse.json(
      {
        access_token: 'jwt-signup-token-xyz',
        user: { ...mockUser, email: body.email, first_name: body.first_name },
        business: { ...mockBusiness, name: body.business_name },
      },
      { status: 201 }
    );
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.email === 'invalid@business.com' || body.password === 'wrongpass') {
      return HttpResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }
    return HttpResponse.json(
      {
        access_token: 'jwt-login-token-xyz',
        user: { ...mockUser, email: body.email },
        business: mockBusiness,
      },
      { status: 200 }
    );
  }),

  // --- BUSINESS ONBOARDING ---
  http.post('*/api/business/onboarding', async ({ request }) => {
    const body = (await request.json()) as any;
    if (!body.name || !body.category) {
      return HttpResponse.json(
        { message: 'Business name and category are required' },
        { status: 400 }
      );
    }
    return HttpResponse.json(
      {
        ...mockBusiness,
        name: body.name,
        category: body.category,
        phone: body.phone || null,
        website: body.website || null,
        location: body.location || null,
      },
      { status: 200 }
    );
  }),

  // --- CUSTOMER MANAGEMENT ---
  http.get('*/api/customers', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    let filtered = mockCustomers;
    if (search) {
      filtered = mockCustomers.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.phone.includes(search)
      );
    }
    return HttpResponse.json({
      data: filtered,
      total: filtered.length,
    });
  }),

  http.post('*/api/customers', async ({ request }) => {
    const body = (await request.json()) as any;
    if (!body.name || !body.phone) {
      return HttpResponse.json(
        { message: 'Name and Phone number are required' },
        { status: 400 }
      );
    }
    const newCust = {
      id: `cust-${Date.now()}`,
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      notes: body.notes || null,
      tags: body.tags || [],
      last_request_sent_at: null,
      request_count: 0,
      created_on: new Date().toISOString(),
    };
    return HttpResponse.json(newCust, { status: 201 });
  }),

  http.delete('*/api/customers/:id', () => {
    return HttpResponse.json({ success: true, message: 'Customer removed' });
  }),

  // --- WHATSAPP TESTIMONIAL REQUESTS ---
  http.post('*/api/requests/send', async ({ request }) => {
    const body = (await request.json()) as any;
    if (!body.customer_id) {
      return HttpResponse.json(
        { message: 'Customer ID is required' },
        { status: 400 }
      );
    }
    return HttpResponse.json(
      {
        id: `req-${Date.now()}`,
        business_id: mockBusiness.id,
        customer_id: body.customer_id,
        status: 'SENT',
        created_on: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  http.post('*/api/requests/batch', async ({ request }) => {
    const body = (await request.json()) as any;
    if (!body.customer_ids || !body.customer_ids.length) {
      return HttpResponse.json(
        { message: 'At least one customer ID is required' },
        { status: 400 }
      );
    }
    return HttpResponse.json(
      {
        message: `Dispatched WhatsApp requests to ${body.customer_ids.length} contacts`,
        count: body.customer_ids.length,
      },
      { status: 200 }
    );
  }),

  // --- PUBLIC TESTIMONIAL FORM ---
  http.get('*/api/testimonials/public/:slug/info', ({ params }) => {
    if (params.slug === 'unknown-business') {
      return HttpResponse.json(
        { message: 'Business not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      id: mockBusiness.id,
      name: mockBusiness.name,
      slug: params.slug,
      category: mockBusiness.category,
      logo_url: mockBusiness.logo_url,
      location: mockBusiness.location,
    });
  }),

  http.post('*/api/testimonials/public/:slug', async ({ request, params }) => {
    const body = (await request.json()) as any;
    if (!body.content || !body.customer_name || !body.rating) {
      return HttpResponse.json(
        { message: 'Validation failed' },
        { status: 400 }
      );
    }
    return HttpResponse.json(
      {
        success: true,
        message: 'Your review has been submitted for review. Thank you!',
        id: `test-${Date.now()}`,
      },
      { status: 201 }
    );
  }),

  // --- TESTIMONIAL MODERATION (BUSINESS DASHBOARD) ---
  http.get('*/api/testimonials', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    let data = mockTestimonials;
    if (status && status !== 'ALL') {
      data = mockTestimonials.filter((t) => t.approval_status === status);
    }
    return HttpResponse.json({
      data,
      total: data.length,
      page: 1,
      limit: 20,
      counts: {
        total: mockTestimonials.length,
        pending: mockTestimonials.filter((t) => t.approval_status === 'PENDING').length,
        approved: mockTestimonials.filter((t) => t.approval_status === 'APPROVED').length,
        rejected: mockTestimonials.filter((t) => t.approval_status === 'REJECTED').length,
        averageRating: 5,
      },
    });
  }),

  http.patch('*/api/testimonials/:id/status', async ({ request, params }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: params.id,
      approval_status: body.status,
      rejection_reason: body.rejection_reason || null,
      updated_on: new Date().toISOString(),
    });
  }),

  http.delete('*/api/testimonials/:id', () => {
    return HttpResponse.json({ success: true, message: 'Deleted' });
  }),

  // --- WIDGET MANAGEMENT ---
  http.get('*/api/widgets', () => {
    return HttpResponse.json(mockWidgets);
  }),

  http.post('*/api/widgets', async ({ request }) => {
    const body = (await request.json()) as any;
    if (!body.name) {
      return HttpResponse.json(
        { message: 'Widget name is required' },
        { status: 400 }
      );
    }
    const newWidget = {
      id: `widget-${Date.now()}`,
      name: body.name,
      type: body.type || 'WALL',
      theme: body.theme || 'DARK',
      primary_color: body.primary_color || '#10b981',
      min_rating: body.min_rating ?? 4,
      show_google_reviews: body.show_google_reviews ?? true,
      show_photos: body.show_photos ?? true,
      custom_css: body.custom_css || null,
      embed_token: `zen_${Date.now()}`,
      is_active: true,
      views_count: 0,
      created_on: new Date().toISOString(),
    };
    return HttpResponse.json(newWidget, { status: 201 });
  }),

  // --- PUBLIC WIDGET DATA (EMBED) ---
  http.get('*/api/widgets/public/:id', ({ params }) => {
    if (params.id === 'inactive-widget') {
      return HttpResponse.json(
        { message: 'Widget not found or inactive' },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      widget: {
        id: params.id as string,
        name: 'Wall of Love',
        type: 'WALL',
        theme: 'DARK',
        primary_color: '#10b981',
        min_rating: 4,
        show_google_reviews: true,
        show_photos: true,
        custom_css: null,
      },
      business: {
        id: mockBusiness.id,
        name: mockBusiness.name,
        slug: mockBusiness.slug,
      },
      stats: {
        average_rating: 5,
        total_reviews: 1,
        testimonials_count: 1,
        google_reviews_count: 0,
      },
      items: [
        {
          id: 'test-2',
          source: 'ZENVLO',
          author_name: 'Priya Patel',
          author_photo_url: null,
          rating: 5,
          content: 'Best service in town! Highly recommend their spa packages.',
          photo_url: 'https://example.com/photo.jpg',
          video_url: null,
          is_verified: true,
          date: '2026-01-02T15:00:00.000Z',
        },
      ],
    });
  }),

  // --- REQUESTS & ANALYTICS ---
  http.get('*/api/requests/analytics', () => {
    return HttpResponse.json(mockRequestAnalytics);
  }),

  http.get('*/api/requests/stats', () => {
    return HttpResponse.json({
      total_sent: 12,
      delivered: 9,
      read: 6,
      failed: 1,
      pending_contract: 2,
      feedback_received: 4,
      delivery_rate: 90,
      feedback_conversion_rate: 33,
    });
  }),

  http.get('*/api/requests', () => {
    return HttpResponse.json({
      data: mockRequestLogs,
      total: mockRequestLogs.length,
      page: 1,
      limit: 25,
    });
  }),

  http.post('*/api/requests/send', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      id: 'req-log-new',
      customer_name: body.customer_name || 'New Customer',
      customer_phone: body.customer_phone || '+919999988888',
      channel: 'WHATSAPP',
      delivery_status: 'QUEUED',
      created_on: new Date().toISOString(),
    });
  }),

  http.post('*/api/requests/batch', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      total: body.customer_ids?.length || 2,
      queued: body.customer_ids?.length || 2,
      failed: 0,
      logs: [],
    });
  }),

  // --- ONBOARDING STATUS ---
  http.get('*/api/business/onboarding-status', () => {
    return HttpResponse.json({
      business_id: 'biz-uuid-1',
      completed: true,
      dismissed: true,
      current_step: 3,
      completed_steps: ['profile', 'customer', 'request'],
      skipped_steps: [],
      has_profile: true,
      has_customer: true,
      has_request: true,
      has_testimonial: true,
      has_widget: true,
    });
  }),

  http.patch('*/api/business/onboarding-status', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      success: true,
      ...body,
    });
  }),
];

export const mockRequestAnalytics = {
  period: {
    startDate: '2026-09-15T00:00:00.000Z',
    endDate: '2026-10-15T00:00:00.000Z',
    prevStartDate: '2026-08-16T00:00:00.000Z',
    prevEndDate: '2026-09-15T00:00:00.000Z',
    days: 30,
  },
  summary: {
    total_requests: 12,
    confirmed_delivered: 9,
    confirmed_read: 6,
    confirmed_failed: 1,
    pending_confirmation: 2,
    feedback_responses: 4,
    delivery_success_rate: 90.0,
    overall_delivery_rate: 75.0,
    response_rate_delivered: 44.4,
    response_rate_total: 33.3,
  },
  comparison: {
    prev_total_requests: 8,
    prev_confirmed_delivered: 6,
    prev_feedback_responses: 2,
    total_requests_change_pct: 50.0,
    delivered_change_pct: 50.0,
    responses_change_pct: 100.0,
  },
  delivery_breakdown: [
    { status: 'DELIVERED', count: 3, percentage: 25.0, is_terminal: true },
    { status: 'READ', count: 6, percentage: 50.0, is_terminal: true },
    { status: 'PENDING_CONTRACT', count: 2, percentage: 16.7, is_terminal: false },
    { status: 'FAILED', count: 1, percentage: 8.3, is_terminal: true },
  ],
  trend: [
    { date: '2026-10-01', created: 3, delivered: 2, read: 1, failed: 0, pending: 1, responses: 1 },
    { date: '2026-10-02', created: 4, delivered: 3, read: 2, failed: 1, pending: 0, responses: 2 },
    { date: '2026-10-03', created: 5, delivered: 4, read: 3, failed: 0, pending: 1, responses: 1 },
  ],
  meta: {
    channel: 'WHATSAPP',
    unknown_outcomes_count: 2,
    semantics: {
      delivery_success_rate: 'Known outcomes',
    },
  },
};

export const mockRequestLogs = [
  {
    id: 'req-log-1',
    customer_id: 'cust-1',
    customer_name: 'Rahul Sharma',
    customer_phone: '+919988776655',
    channel: 'WHATSAPP',
    template_name: 'testimonial_request',
    testimonial_url: 'http://localhost:3000/submit/zenvlo-wellness',
    custom_message: 'Thanks for coming in!',
    delivery_status: 'DELIVERED',
    message_id: 'msg_101',
    error_message: null,
    sent_at: '2026-10-01T10:00:00.000Z',
    delivered_at: '2026-10-01T10:02:00.000Z',
    read_at: null,
    testimonial_id: 'test-1',
    response_received_at: '2026-10-01T12:00:00.000Z',
    created_on: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'req-log-2',
    customer_id: 'cust-2',
    customer_name: 'Priya Patel',
    customer_phone: '+919988776644',
    channel: 'WHATSAPP',
    template_name: 'testimonial_request',
    testimonial_url: 'http://localhost:3000/submit/zenvlo-wellness',
    custom_message: null,
    delivery_status: 'FAILED',
    message_id: null,
    error_message: 'Invalid phone number format',
    sent_at: '2026-10-02T11:00:00.000Z',
    delivered_at: null,
    read_at: null,
    testimonial_id: null,
    response_received_at: null,
    created_on: '2026-10-02T11:00:00.000Z',
  },
];

