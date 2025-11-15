export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Validate and calculate pagination parameters
 */
export const getPaginationParams = (
  page?: number | string,
  limit?: number | string
): PaginationParams => {
  // Parse and validate page
  let parsedPage = typeof page === 'string' ? parseInt(page, 10) : page;
  parsedPage = parsedPage && parsedPage > 0 ? parsedPage : DEFAULT_PAGE;

  // Parse and validate limit
  let parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  parsedLimit = parsedLimit && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  parsedLimit = Math.min(parsedLimit, MAX_LIMIT);

  // Calculate skip
  const skip = (parsedPage - 1) * parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
  };
};

/**
 * Format paginated response with consistent structure
 */
export const formatPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};
