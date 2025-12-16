'use client';

import { useRouter } from 'next/navigation';
import { Car, Store, ArrowRight, CheckCircle, Shield, Clock, Users, Star, Zap } from 'lucide-react';

export default function RegisterLandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Pasakay</h1>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-4 sm:mb-6 px-2">
            Join Pasakay Today
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
            Become a partner and start earning with the leading ride-hailing and food delivery platform
          </p>
          
        </div>

        {/* Registration Cards */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {/* Driver Registration Card */}
          <div className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 hover:-translate-y-1">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 sm:p-6 md:p-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                <Car className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-2xl sm:text-2xl md:text-3xl font-bold mb-2 text-white">Drive with Pasakay</h3>
              <p className="text-white/90 text-sm sm:text-base">
                Earn money on your schedule as a driver
              </p>
            </div>

            <div className="p-5 sm:p-6 md:p-8">
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Flexible Schedule</h4>
                    <p className="text-sm text-gray-600">Drive whenever you want</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Competitive Earnings</h4>
                    <p className="text-sm text-gray-600">Keep more of what you earn</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Safety First</h4>
                    <p className="text-sm text-gray-600">In-app safety features</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">Requirements:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Valid driver&apos;s license</li>
                  <li>• Motorcycle or tricycle</li>
                  <li>• Vehicle registration (OR/CR)</li>
                  <li>• Android or iOS smartphone</li>
                </ul>
              </div>

              <button
                onClick={() => router.push('/register/driver')}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg group/btn"
              >
                Register as Driver
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Merchant Registration Card */}
          <div className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 hover:-translate-y-1">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-5 sm:p-6 md:p-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
                <Store className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-2xl sm:text-2xl md:text-3xl font-bold mb-2 text-white">Sell on Pasakay</h3>
              <p className="text-white/90 text-sm sm:text-base">
                Grow your food business with delivery
              </p>
            </div>

            <div className="p-5 sm:p-6 md:p-8">
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Reach More Customers</h4>
                    <p className="text-sm text-gray-600">Expand your business online</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Easy Management</h4>
                    <p className="text-sm text-gray-600">Simple merchant dashboard</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Fast Delivery</h4>
                    <p className="text-sm text-gray-600">Our drivers deliver quickly</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">Requirements:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Valid business permit</li>
                  <li>• Food establishment</li>
                  <li>• Sanitary permit (recommended)</li>
                  <li>• Business contact info</li>
                </ul>
              </div>

              <button
                onClick={() => router.push('/register/merchant')}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg group/btn"
              >
                Register as Merchant
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="bg-white border-t border-gray-200 py-10 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12">
            Why Partner with Pasakay?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center group cursor-default p-4 sm:p-6 rounded-xl hover:bg-blue-50 transition-colors duration-300">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 group-hover:bg-blue-200 transition-all duration-300">
                <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">Trusted Platform</h4>
              <p className="text-sm sm:text-base text-gray-600">
                Join a reliable and secure platform trusted by thousands
              </p>
            </div>
            <div className="text-center group cursor-default p-4 sm:p-6 rounded-xl hover:bg-purple-50 transition-colors duration-300">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 group-hover:bg-purple-200 transition-all duration-300">
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">Quick Approval</h4>
              <p className="text-sm sm:text-base text-gray-600">
                Fast verification process to get you started quickly
              </p>
            </div>
            <div className="text-center group cursor-default p-4 sm:p-6 rounded-xl hover:bg-green-50 transition-colors duration-300">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 group-hover:bg-green-200 transition-all duration-300">
                <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" />
              </div>
              <h4 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">Full Support</h4>
              <p className="text-sm sm:text-base text-gray-600">
                Dedicated support team to help you succeed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">P</span>
            </div>
            <span className="text-lg sm:text-xl font-bold">Pasakay</span>
          </div>
          <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
            © {new Date().getFullYear()} Pasakay. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
            <button className="text-gray-400 hover:text-white transition-colors hover:underline">
              Terms of Service
            </button>
            <button className="text-gray-400 hover:text-white transition-colors hover:underline">
              Privacy Policy
            </button>
            <button className="text-gray-400 hover:text-white transition-colors hover:underline">
              Help Center
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
