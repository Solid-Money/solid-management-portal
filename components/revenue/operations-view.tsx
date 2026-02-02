"use client";

import { useState } from "react";
import { useRevenueByProduct } from "@/hooks/use-revenue";
import { DateRangePicker } from "./date-range-picker";
import { Loader2, AlertCircle, Users, TrendingUp, TrendingDown } from "lucide-react";
import { subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { REVENUE_COLORS } from "@/types/revenue";

export function OperationsView() {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 90),
    end: new Date(),
  });

  const {
    data: productsData,
    isLoading,
    error,
  } = useRevenueByProduct(dateRange.start, dateRange.end);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-gray-900 font-medium">Failed to load operations data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex justify-between items-center">
        <DateRangePicker
          startDate={dateRange.start}
          endDate={dateRange.end}
          onRangeChange={(start, end) => {
            setDateRange({ start, end });
          }}
        />
      </div>

      {/* Product Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Revenue by Product
        </h3>
        {productsData?.products && productsData.products.length > 0 ? (
          <div className="space-y-4">
            {productsData.products.map((product) => {
              const percentage =
                productsData.totalRevenue > 0
                  ? (product.revenue / productsData.totalRevenue) * 100
                  : 0;
              const colorKey =
                product.revenueType === "yield_share"
                  ? "yieldShare"
                  : "borrowingFees";
              const color = REVENUE_COLORS[colorKey];
              const isPositive = product.trend.startsWith("+");

              return (
                <div key={product.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {product.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">
                        ${product.revenue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span
                        className={cn(
                          "flex items-center text-xs font-medium",
                          isPositive ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {product.trend}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{percentage.toFixed(1)}% of total</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {product.users.toLocaleString()} users
                    </span>
                  </div>
                </div>
              );
            })}

            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Total</span>
                <span className="text-lg font-bold text-gray-900">
                  ${productsData.totalRevenue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No product data available
          </div>
        )}
      </div>
    </div>
  );
}

export default OperationsView;
