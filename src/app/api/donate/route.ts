import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface StripeDonationRequest {
  amount: number;
  artistName: string;
  artistId?: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: StripeDonationRequest = await request.json();
    const { amount, artistName, artistId, email } = body;

    // Validate required fields
    if (!amount || !artistName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount < 1) {
      return NextResponse.json(
        { error: "Amount must be at least $1.00" },
        { status: 400 }
      );
    }

    console.log(`Processing Stripe donation: $${amount} to ${artistName}`);

    // Forward to Express backend server
    const backendResponse = await fetch('http://localhost:3001/donate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        artistName,
        artistId,
        email: email || session.user.email
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('Backend server error:', errorData);
      
      return NextResponse.json(
        { error: "Payment processing failed", details: errorData },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    
    console.log(`Stripe donation successful: ${result.paymentIntentId}`);

    return NextResponse.json({
      success: true,
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      amount: result.amount,
      currency: result.currency,
      artistName: result.artistName,
      status: result.status,
      message: result.message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Stripe donation error:", error);
    
    return NextResponse.json(
      { 
        error: "Payment processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Get donation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('id');

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent ID required" },
        { status: 400 }
      );
    }

    // Forward to Express backend server
    const backendResponse = await fetch(`http://localhost:3001/donate/${paymentIntentId}`);

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      return NextResponse.json(
        { error: "Failed to retrieve payment status", details: errorData },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error retrieving payment status:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to retrieve payment status",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
