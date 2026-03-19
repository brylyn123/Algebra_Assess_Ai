import React from 'react';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
    const navigate = useNavigate();
    return (
        <div
            className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden"
            style={{
                backgroundImage: 'linear-gradient(#cbd7ed 1px, transparent 1px), linear-gradient(90deg, #cbd7ed 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                backgroundColor: '#e0edff',
            }}
        >
            {/* Navbar */}
            <nav className="flex justify-between items-center px-10 py-4 sticky top-0 bg-blue-600 text-white shadow-md z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <span className="font-bold text-2xl tracking-tight text-white">AlgebraAssess</span>
                </div>
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/login')} className="font-semibold text-white/80 hover:text-white transition">Login</button>
                    <button onClick={() => navigate('/signup')} className="bg-white text-blue-600 px-6 py-2.5 rounded-full font-bold hover:bg-slate-100 transition shadow-lg">
                        Sign Up
                    </button>
                </div>
            </nav>

            {/* Main Hero Section */}
            <main className="max-w-7xl mx-auto px-10 py-16 grid lg:grid-cols-2 gap-16 items-center">
                {/* Left Side: Text Content */}
                <div className="space-y-6">
                    <h1 className="text-indigo-600 font-bold text-5xl leading-tight">AlgebraAssess:</h1>
                    <h2 className="text-slate-900 font-extrabold text-6xl leading-[1.1]">Intelligent Grading for <br /> Modern Educators</h2>
                    <p className="text-slate-500 text-xl leading-relaxed max-w-lg">
                        Revolutionize your math classroom. Our AI-powered platform transforms handwritten algebra assignments into instantly graded, personalized feedback based on your expert rubrics.
                    </p>
                    <div className="flex gap-4 pt-4">
                        <button onClick={() => navigate('/signup')} className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition">
                            Get Started Free
                        </button>
                        <button className="border border-slate-200 text-slate-700 px-10 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 transition">
                            Learn More
                        </button>
                    </div>
                </div>

                {/* Right Side: Workflow Card */}
                <div className="bg-white p-10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-50 relative">
                    <div className="absolute top-6 right-8 text-slate-400 text-sm font-medium flex items-center gap-1">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        AI-Powered Grading
                    </div>
                    <h3 className="font-bold text-2xl text-slate-800 mb-10">Streamlined Workflow</h3>
                    <div className="space-y-10">
                        {[
                            { step: 1, title: "Create Rubrics", desc: "Define grading criteria for precise, consistent evaluation." },
                            { step: 2, title: "Upload Solution", desc: "Capture or upload students' handwritten work via camera." },
                            { step: 3, title: "Get AI Feedback", desc: "Instant multimodal reasoning scores the math based on your rules." }
                        ].map((item) => (
                            <div key={item.step} className="flex gap-5">
                                <div className="bg-indigo-50 text-indigo-600 font-bold w-10 h-10 rounded-full flex items-center justify-center shrink-0">{item.step}</div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">{item.title}</h4>
                                    <p className="text-slate-500">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Features Grid Section (Based on your "Blue Grid" screenshot) */}
            <section className="py-24 bg-slate-50 relative" style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                <div className="max-w-7xl mx-auto px-10">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-extrabold text-slate-900">Why Choose AlgebraAssess?</h2>
                        <p className="text-slate-500 mt-4 text-lg">Built for educators, powered by advanced technology</p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Handwriting OCR */}
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center hover:scale-105 transition duration-300">
                            <span className="text-4xl">📝</span>
                            <h3 className="font-bold text-xl mt-6 mb-3">Handwriting OCR</h3>
                            <p className="text-slate-500">Don't type it out. Our advanced OCR understands complex handwritten algebraic expressions.</p>
                        </div>
                        {/* Custom Rubrics */}
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center hover:scale-105 transition duration-300">
                            <span className="text-4xl">⚖️</span>
                            <h3 className="font-bold text-xl mt-6 mb-3">Custom Rubrics</h3>
                            <p className="text-slate-500">Create flexible grading criteria to match your specific assessment needs and award partial credit.</p>
                        </div>
                        {/* Instant Results */}
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-center hover:scale-105 transition duration-300">
                            <span className="text-4xl">🚀</span>
                            <h3 className="font-bold text-xl mt-6 mb-3">Instant Results</h3>
                            <p className="text-slate-500">Save hours of grading time. Get immediate analysis and detailed feedback generation.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Focus on Teaching Section */}
            <section className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-10 flex flex-col lg:flex-row items-center gap-16 bg-slate-50 rounded-[3rem] p-12 border border-slate-100 shadow-inner">
                    <div className="flex-1 space-y-6">
                        <h2 className="text-4xl font-bold text-slate-900 leading-tight">Focus on Teaching, <br /> Not Grading</h2>
                        <p className="text-slate-500 text-lg leading-relaxed">
                            Teachers spend an average of 10 hours a week grading. AlgebraAssess AI gives that time back to you, allowing you to focus on student engagement.
                        </p>
                        <div className="space-y-4">
                            {['Consistent Grading: Eliminate bias and fatigue.', 'Detailed Feedback: AI explains mistakes to students.', 'Data Driven: Track class performance over time.'].map((text, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="bg-green-100 text-green-600 rounded-md p-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <span className="font-medium text-slate-700">{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 flex justify-center">
                        <div className="relative">
                            <div className="w-64 h-64 bg-indigo-100 rounded-full flex items-center justify-center text-8xl">🎓</div>
                            <div className="absolute -bottom-4 -right-4 bg-white p-4 rounded-2xl shadow-lg border border-indigo-100 animate-bounce">
                                <span className="text-indigo-600 font-bold">+10 hrs Saved</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            {/* Final CTA */}
            <section className="py-20 bg-slate-100">
                <div className="max-w-4xl mx-auto text-center space-y-6">
                    <h2 className="text-4xl font-extrabold text-slate-900">Ready to transform your classroom?</h2>
                    <button onClick={() => navigate('/signup')} className="bg-blue-600 text-white rounded-full px-10 py-4 text-lg font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 transition">
                        Join Now for Free
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200">
                <div className="max-w-6xl mx-auto px-10 py-12 grid md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 rounded-lg p-2 shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-slate-900">AlgebraAssess</span>
                        </div>
                        <p className="text-slate-500">Revolutionizing assessment, grading with AI</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Resources</h3>
                        <ul className="space-y-1 text-slate-500 mt-4">
                            <li className="hover:text-slate-900 transition cursor-pointer">Privacy Policy</li>
                            <li className="hover:text-slate-900 transition cursor-pointer">Terms of Service</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">Contact Us</h3>
                        <div className="mt-4 flex items-center gap-2 text-slate-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>info@algebraassess.com</span>
                        </div>
                    </div>
                </div>
                <div className="border-t border-slate-100">
                    <div className="bg-blue-600">
                        <p className="max-w-6xl mx-auto px-10 py-6 text-center text-sm text-white">\u00A9 2025 AlgebraAssess. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
