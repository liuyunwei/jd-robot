<div>
	<p>为了防止Apple服务器抽风，支付页面打不开，特将二维码和支付信息抽了出来，直接扫码支付即可。查看订单的具体状态，请查询来自Apple的邮件。</p>
	<h2>订单号: <%=data.orderNumber%></h2>
	<h2>邮箱: <%=context.user.emailAddress%></h2>
	<h2>电话: <%=context.user.daytimePhone%></h2>
	<p><%=context.uid%> | <%=status%></p>
	<div><%=data.QrImageHtml%></div>
	<hr/>
	<h2>Iphone</h2>
	<ul>
		<%for(var key in context.iphone){%>
		<li><%=key%> : <%=context.iphone[key]%></li>
		<%}%>
	</ul>
	<h2>User</h2>
	<ul>
		<%for(var key in context.user){%>
		<li><%=key%> : <%=context.user[key]%></li>
		<%}%>
	</ul>
</div>